/**
 * 论坛公开 + 会员接口 — 挂在 /api/forum。
 *
 * 设计约束（见 FORUM.md）：
 * - 版块由管理员创建，用户不能自建
 * - 读取公开，写入需会员登录
 * - 会员状态 archived/muted/banned 影响能否发帖
 * - 计数冗余（reply_count / last_reply_at）在事务里维护
 */

import { Hono } from 'hono'
import { and, asc, count, desc, eq, inArray, or, sql } from 'drizzle-orm'
import type {
  ForumAuthor,
  ForumBoard,
  ForumPost,
  ForumPostPolicy,
  ForumTopic,
  ForumTopicStatus,
  ForumTopicSummary,
  UserRole,
  UserStatus,
} from '@school/shared'
import { getDb } from '../db/client'
import {
  forumBoards,
  forumPosts,
  forumTopics,
  users,
  type ForumBoardRow,
  type ForumPostRow,
  type ForumTopicRow,
} from '../db/schema'
import { fail, iso, makeSlug, ok, parseIntParam, readJson, uniqueSlug } from '../lib/utils'
import { optionalUser, requireUser, type AppBindings } from '../middleware/auth'

export const forumRoutes = new Hono<AppBindings>()

/* ------------------------------------------------------------------ */
/* 序列化                                                              */
/* ------------------------------------------------------------------ */

function serializeBoard(row: ForumBoardRow, topicCount?: number, lastActivityAt?: string | null): ForumBoard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    sortOrder: row.sortOrder,
    postPolicy: row.postPolicy as ForumPostPolicy,
    needsReview: row.needsReview,
    archived: row.archived,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    ...(topicCount === undefined ? {} : { topicCount }),
    ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
  }
}

/**
 * 作者信息必须从 users 表取真实数据，不能信任会话里的 displayName ——
 * 用户改了昵称或被封禁，列表页要立刻反映出来。
 */
function toAuthor(row: {
  id: number
  username: string
  displayName: string
  avatar: string | null
  role: string
  status: string
}): ForumAuthor {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    role: (row.role === 'moderator' ? 'moderator' : 'member') as UserRole,
    status: (
      row.status === 'muted' || row.status === 'banned' ? row.status : 'active'
    ) as UserStatus,
  }
}

function serializeTopicSummary(
  row: ForumTopicRow,
  author: ForumAuthor,
  board?: Pick<ForumBoard, 'id' | 'name' | 'slug' | 'color'>,
): ForumTopicSummary {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    slug: row.slug,
    status: row.status as ForumTopicStatus,
    pinned: row.pinned,
    locked: row.locked,
    views: row.views,
    replyCount: row.replyCount,
    lastReplyAt: iso(row.lastReplyAt),
    createdAt: iso(row.createdAt)!,
    author,
    ...(board ? { board } : {}),
  }
}

function serializeTopic(
  row: ForumTopicRow,
  author: ForumAuthor,
  board?: Pick<ForumBoard, 'id' | 'name' | 'slug' | 'color'>,
): ForumTopic {
  return {
    ...serializeTopicSummary(row, author, board),
    content: row.content,
    updatedAt: iso(row.updatedAt)!,
  }
}

function serializePost(row: ForumPostRow, author: ForumAuthor, replyToAuthor?: string | null): ForumPost {
  return {
    id: row.id,
    topicId: row.topicId,
    content: row.content,
    status: row.status as ForumPost['status'],
    replyTo: row.replyTo,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    author,
    replyToAuthor: replyToAuthor ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* 发帖校验                                                            */
/* ------------------------------------------------------------------ */

/** 内容长度约束。太短的帖子没有信息量，太长会拖慢列表页 */
const MIN_CONTENT = 2
const MAX_CONTENT = 20000
const MIN_TITLE = 2
const MAX_TITLE = 200

/**
 * 检查当前会员是否有权在该版块发主题。
 * 返回错误信息，null 表示可以发。
 */
function checkPostPermission(
  board: ForumBoardRow,
  userStatus: UserStatus,
  userRole: UserRole,
): string | null {
  if (board.archived) return '该版块已归档，无法发布新主题'
  if (userStatus === 'banned') return '账号已被封禁，无法发帖'
  if (userStatus === 'muted') return '账号已被禁言，暂时无法发帖'

  const policy = board.postPolicy as ForumPostPolicy
  if (policy === 'staff_only' && userRole !== 'moderator') {
    return '该版块仅管理员可以发布主题'
  }
  if (policy === 'member_only' && userRole === 'member' && userStatus !== 'active') {
    return '当前账号状态无法在该版块发帖'
  }
  return null
}

/**
 * 发帖频率限制。
 *
 * 必须在数据库里查，不能放内存 —— serverless 函数实例随时销毁，
 * 内存计数完全拦不住。10 分钟 5 帖对校内论坛足够宽松。
 */
const RATE_WINDOW_MINUTES = 10
const RATE_MAX_POSTS = 5

async function checkRateLimit(db: ReturnType<typeof getDb>, userId: number): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000)

  const topicRows = await db
    .select({ n: count() })
    .from(forumTopics)
    .where(and(eq(forumTopics.authorId, userId), sql`${forumTopics.createdAt} > ${since}`))

  const postRows = await db
    .select({ n: count() })
    .from(forumPosts)
    .where(and(eq(forumPosts.authorId, userId), sql`${forumPosts.createdAt} > ${since}`))

  const total = Number(topicRows[0]?.n ?? 0) + Number(postRows[0]?.n ?? 0)
  return total < RATE_MAX_POSTS
}

/* ------------------------------------------------------------------ */
/* 版块                                                                */
/* ------------------------------------------------------------------ */

/** 版块列表：附带每个版块的主题数与最后活跃时间（首页要展示） */
forumRoutes.get('/boards', async (c) => {
  const db = getDb()

  const boards = await db
    .select()
    .from(forumBoards)
    .where(eq(forumBoards.archived, false))
    .orderBy(asc(forumBoards.sortOrder), asc(forumBoards.id))

  // 一次聚合出所有版块的统计，避免 N+1
  const stats = await db
    .select({
      boardId: forumTopics.boardId,
      topicCount: count(),
      lastActivityAt: sql<string | null>`max(${forumTopics.lastReplyAt})`,
    })
    .from(forumTopics)
    .where(eq(forumTopics.status, 'published'))
    .groupBy(forumTopics.boardId)

  const statMap = new Map(stats.map((s) => [s.boardId, s]))

  return ok(c, {
    boards: boards.map((board) => {
      const stat = statMap.get(board.id)
      return serializeBoard(
        board,
        Number(stat?.topicCount ?? 0),
        iso(stat?.lastActivityAt ?? null),
      )
    }),
  })
})

/* ------------------------------------------------------------------ */
/* 主题列表                                                            */
/* ------------------------------------------------------------------ */

/** 版块内的主题列表。置顶帖永远排在最前 */
forumRoutes.get('/boards/:slug/topics', async (c) => {
  const db = getDb()
  const slug = c.req.param('slug')

  const [board] = await db.select().from(forumBoards).where(eq(forumBoards.slug, slug)).limit(1)
  if (!board) return fail(c, 404, 'not_found', '版块不存在')

  const page = parseIntParam(c.req.query('page'), 1, 1, 100000)
  const pageSize = parseIntParam(c.req.query('pageSize'), 20, 1, 50)
  const sort = c.req.query('sort') ?? 'latest'

  const where = and(eq(forumTopics.boardId, board.id), eq(forumTopics.status, 'published'))

  // 排序：置顶优先，然后按所选维度
  const orderBy =
    sort === 'hot'
      ? [desc(forumTopics.pinned), desc(forumTopics.replyCount), desc(forumTopics.createdAt)]
      : sort === 'new'
        ? [desc(forumTopics.pinned), desc(forumTopics.createdAt)]
        : [desc(forumTopics.pinned), desc(sql`coalesce(${forumTopics.lastReplyAt}, ${forumTopics.createdAt})`)]

  const rows = await db
    .select({
      topic: forumTopics,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        role: users.role,
        status: users.status,
      },
    })
    .from(forumTopics)
    .innerJoin(users, eq(forumTopics.authorId, users.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ n: total }] = await db.select({ n: count() }).from(forumTopics).where(where)

  return ok(c, {
    board: serializeBoard(board),
    topics: rows.map((r) =>
      serializeTopicSummary(r.topic, toAuthor(r.author), {
        id: board.id,
        name: board.name,
        slug: board.slug,
        color: board.color,
      }),
    ),
    pagination: { page, pageSize, total: Number(total) },
  })
})

/* ------------------------------------------------------------------ */
/* 主题详情                                                            */
/* ------------------------------------------------------------------ */

forumRoutes.get('/topics/:slug', async (c) => {
  const db = getDb()
  const slug = c.req.param('slug')

  const [row] = await db
    .select({
      topic: forumTopics,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        role: users.role,
        status: users.status,
      },
      board: forumBoards,
    })
    .from(forumTopics)
    .innerJoin(users, eq(forumTopics.authorId, users.id))
    .innerJoin(forumBoards, eq(forumTopics.boardId, forumBoards.id))
    .where(eq(forumTopics.slug, slug))
    .limit(1)

  if (!row) return fail(c, 404, 'not_found', '主题不存在')

  // 非公开主题只有作者本人能看（预览自己的待审帖）
  if (row.topic.status !== 'published') {
    const session = c.get('user')
    const isAuthor = session && Number(session.sub) === row.topic.authorId
    if (!isAuthor) return fail(c, 404, 'not_found', '主题不存在')
  }

  // 浏览量自增。不做去重（同一人刷新会重复计数），校内论坛量级下不值得引入 IP 表
  await db
    .update(forumTopics)
    .set({ views: sql`${forumTopics.views} + 1` })
    .where(eq(forumTopics.id, row.topic.id))

  const page = parseIntParam(c.req.query('page'), 1, 1, 100000)
  const pageSize = parseIntParam(c.req.query('pageSize'), 30, 1, 100)

  const postRows = await db
    .select({
      post: forumPosts,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        role: users.role,
        status: users.status,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(and(eq(forumPosts.topicId, row.topic.id), eq(forumPosts.status, 'published')))
    .orderBy(asc(forumPosts.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ n: postTotal }] = await db
    .select({ n: count() })
    .from(forumPosts)
    .where(and(eq(forumPosts.topicId, row.topic.id), eq(forumPosts.status, 'published')))

  // 被回复作者的名称：一次性批量查，避免每条回复都查一次
  const replyToIds = [...new Set(postRows.map((r) => r.post.replyTo).filter((v): v is number => v != null))]
  const replyToAuthors = new Map<number, string>()
  if (replyToIds.length) {
    const rows2 = await db
      .select({ id: forumPosts.id, displayName: users.displayName })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.authorId, users.id))
      .where(inArray(forumPosts.id, replyToIds))
    for (const r of rows2) replyToAuthors.set(r.id, r.displayName)
  }

  return ok(c, {
    topic: serializeTopic(row.topic, toAuthor(row.author), {
      id: row.board.id,
      name: row.board.name,
      slug: row.board.slug,
      color: row.board.color,
    }),
    board: serializeBoard(row.board),
    posts: postRows.map((r) =>
      serializePost(
        r.post,
        toAuthor(r.author),
        r.post.replyTo ? (replyToAuthors.get(r.post.replyTo) ?? null) : null,
      ),
    ),
    pagination: { page, pageSize, total: Number(postTotal) },
  })
})

/* ------------------------------------------------------------------ */
/* 全站最新主题（首页区块用）                                          */
/* ------------------------------------------------------------------ */

forumRoutes.get('/recent', async (c) => {
  const db = getDb()
  const limit = parseIntParam(c.req.query('limit'), 6, 1, 20)

  const rows = await db
    .select({
      topic: forumTopics,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        role: users.role,
        status: users.status,
      },
      board: forumBoards,
    })
    .from(forumTopics)
    .innerJoin(users, eq(forumTopics.authorId, users.id))
    .innerJoin(forumBoards, eq(forumTopics.boardId, forumBoards.id))
    .where(eq(forumTopics.status, 'published'))
    .orderBy(desc(sql`coalesce(${forumTopics.lastReplyAt}, ${forumTopics.createdAt})`))
    .limit(limit)

  return ok(c, {
    topics: rows.map((r) =>
      serializeTopicSummary(r.topic, toAuthor(r.author), {
        id: r.board.id,
        name: r.board.name,
        slug: r.board.slug,
        color: r.board.color,
      }),
    ),
  })
})

/* ------------------------------------------------------------------ */
/* 发主题（需登录）                                                    */
/* ------------------------------------------------------------------ */

forumRoutes.post('/topics', requireUser, async (c) => {
  const db = getDb()
  const session = c.get('user')
  const userId = Number(session.sub)

  const body = await readJson<{ boardId?: number; title?: string; content?: string }>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const boardId = Number(body.boardId)
  const title = String(body.title ?? '').trim()
  const content = String(body.content ?? '').trim()

  if (!Number.isFinite(boardId)) return fail(c, 400, 'invalid_board', '请选择版块')
  if (title.length < MIN_TITLE) return fail(c, 400, 'invalid_title', `标题至少 ${MIN_TITLE} 个字`)
  if (title.length > MAX_TITLE) return fail(c, 400, 'invalid_title', `标题最多 ${MAX_TITLE} 个字`)
  if (content.length < MIN_CONTENT) return fail(c, 400, 'invalid_content', '正文不能为空')
  if (content.length > MAX_CONTENT) return fail(c, 400, 'invalid_content', '正文过长')

  const [board] = await db.select().from(forumBoards).where(eq(forumBoards.id, boardId)).limit(1)
  if (!board) return fail(c, 404, 'not_found', '版块不存在')

  // 账号状态以数据库为准，不能只看会话（可能刚被禁言）
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return fail(c, 401, 'unauthorized', '请先登录')

  const userStatus = (
    user.status === 'muted' || user.status === 'banned' ? user.status : 'active'
  ) as UserStatus
  const userRole = (user.role === 'moderator' ? 'moderator' : 'member') as UserRole

  const denied = checkPostPermission(board, userStatus, userRole)
  if (denied) return fail(c, 403, 'forbidden', denied)

  if (!(await checkRateLimit(db, userId))) {
    return fail(
      c,
      429,
      'too_many_requests',
      `发帖过于频繁，${RATE_WINDOW_MINUTES} 分钟内最多 ${RATE_MAX_POSTS} 帖，请稍后再试`,
    )
  }

  const desired = makeSlug(title)
  const slug = await uniqueSlug(desired, async (candidate) => {
    const [hit] = await db
      .select({ id: forumTopics.id })
      .from(forumTopics)
      .where(eq(forumTopics.slug, candidate))
      .limit(1)
    return Boolean(hit)
  })

  const status: ForumTopicStatus = board.needsReview ? 'pending' : 'published'

  const [created] = await db
    .insert(forumTopics)
    .values({ boardId, authorId: userId, title, slug, content, status })
    .returning()

  return ok(
    c,
    {
      topic: serializeTopic(created, toAuthor(user)),
      pending: status === 'pending',
    },
    201,
  )
})

/* ------------------------------------------------------------------ */
/* 编辑 / 删除自己的主题                                               */
/* ------------------------------------------------------------------ */

/** 会员只能在发布后 30 分钟内改自己的帖子，避免「先发后改」制造争议 */
const EDIT_WINDOW_MINUTES = 30

forumRoutes.patch('/topics/:id', requireUser, async (c) => {
  const db = getDb()
  const session = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, id)).limit(1)
  if (!topic) return fail(c, 404, 'not_found', '主题不存在')
  if (topic.authorId !== Number(session.sub)) return fail(c, 403, 'forbidden', '只能编辑自己的主题')
  if (topic.status === 'deleted') return fail(c, 404, 'not_found', '主题不存在')

  if (Date.now() - topic.createdAt.getTime() > EDIT_WINDOW_MINUTES * 60 * 1000) {
    return fail(c, 403, 'forbidden', `发布超过 ${EDIT_WINDOW_MINUTES} 分钟后不能编辑`)
  }

  const body = await readJson<{ title?: string; content?: string }>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (title.length < MIN_TITLE || title.length > MAX_TITLE) {
      return fail(c, 400, 'invalid_title', `标题需 ${MIN_TITLE}-${MAX_TITLE} 个字`)
    }
    patch.title = title
  }
  if (body.content !== undefined) {
    const content = String(body.content).trim()
    if (content.length < MIN_CONTENT || content.length > MAX_CONTENT) {
      return fail(c, 400, 'invalid_content', '正文长度不合法')
    }
    patch.content = content
  }

  const [updated] = await db
    .update(forumTopics)
    .set(patch)
    .where(eq(forumTopics.id, id))
    .returning()

  const [author] = await db.select().from(users).where(eq(users.id, updated.authorId)).limit(1)

  return ok(c, { topic: serializeTopic(updated, toAuthor(author)) })
})

forumRoutes.delete('/topics/:id', requireUser, async (c) => {
  const db = getDb()
  const session = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, id)).limit(1)
  if (!topic) return fail(c, 404, 'not_found', '主题不存在')
  if (topic.authorId !== Number(session.sub)) return fail(c, 403, 'forbidden', '只能删除自己的主题')

  // 软删除：保留记录，便于事后追溯
  await db
    .update(forumTopics)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(eq(forumTopics.id, id))

  return ok(c, { ok: true })
})

/* ------------------------------------------------------------------ */
/* 回复                                                                */
/* ------------------------------------------------------------------ */

forumRoutes.post('/topics/:id/replies', requireUser, async (c) => {
  const db = getDb()
  const session = c.get('user')
  const userId = Number(session.sub)
  const topicId = Number(c.req.param('id'))
  if (!Number.isFinite(topicId)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId)).limit(1)
  if (!topic) return fail(c, 404, 'not_found', '主题不存在')
  if (topic.status !== 'published') return fail(c, 403, 'forbidden', '该主题当前不可回复')
  if (topic.locked) return fail(c, 403, 'forbidden', '该主题已锁定，无法回复')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return fail(c, 401, 'unauthorized', '请先登录')
  if (user.status === 'banned') return fail(c, 403, 'forbidden', '账号已被封禁，无法回复')
  if (user.status === 'muted') return fail(c, 403, 'forbidden', '账号已被禁言，暂时无法回复')

  const body = await readJson<{ content?: string; replyTo?: number | null }>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const content = String(body.content ?? '').trim()
  if (content.length < MIN_CONTENT) return fail(c, 400, 'invalid_content', '回复不能为空')
  if (content.length > MAX_CONTENT) return fail(c, 400, 'invalid_content', '回复过长')

  if (!(await checkRateLimit(db, userId))) {
    return fail(
      c,
      429,
      'too_many_requests',
      `发言过于频繁，${RATE_WINDOW_MINUTES} 分钟内最多 ${RATE_MAX_POSTS} 帖，请稍后再试`,
    )
  }

  // replyTo 必须是本主题下的回复，否则会把别的主题串进来
  let replyTo: number | null = null
  let replyToAuthor: string | null = null
  if (body.replyTo != null) {
    const candidate = Number(body.replyTo)
    if (Number.isFinite(candidate)) {
      const [target] = await db
        .select({
          id: forumPosts.id,
          topicId: forumPosts.topicId,
          displayName: users.displayName,
        })
        .from(forumPosts)
        .innerJoin(users, eq(forumPosts.authorId, users.id))
        .where(eq(forumPosts.id, candidate))
        .limit(1)
      if (target && target.topicId === topicId) {
        replyTo = candidate
        replyToAuthor = target.displayName
      }
    }
  }

  /*
   * 插入回复与更新主题计数。
   *
   * 注意：这里**不能用 db.transaction()**。Neon 的 HTTP 驱动
   * （drizzle-orm/neon-http）不支持事务，调用会直接抛
   * "No transactions support in neon-http driver"，而 Vercel 上
   * 我们正是跑在这个驱动上。
   *
   * 代价是这两步不是原子的。处理方式：
   *   1. 先插回复（业务主体，必须成功）
   *   2. 再用一条原子 SQL 更新计数（reply_count = reply_count + 1）
   * 第二步失败最坏结果是计数少 1，不影响数据正确性，且下次回复会
   * 从当前值继续累加，不会越错越多。相比让整个发帖失败，这个取舍更好。
   */
  const [post] = await db
    .insert(forumPosts)
    .values({ topicId, authorId: userId, content, replyTo })
    .returning()

  await db
    .update(forumTopics)
    .set({
      replyCount: sql`${forumTopics.replyCount} + 1`,
      lastReplyAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(forumTopics.id, topicId))

  return ok(
    c,
    { post: serializePost(post, toAuthor(user), replyToAuthor) },
    201,
  )
})

forumRoutes.delete('/posts/:id', requireUser, async (c) => {
  const db = getDb()
  const session = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [post] = await db.select().from(forumPosts).where(eq(forumPosts.id, id)).limit(1)
  if (!post) return fail(c, 404, 'not_found', '回复不存在')
  if (post.authorId !== Number(session.sub)) return fail(c, 403, 'forbidden', '只能删除自己的回复')

  /*
   * 软删除。同样不能用事务（Neon HTTP 驱动不支持），
   * 所以先改状态、再原子减计数；顺序反过来会让计数先减而后置状态失败。
   */
  await db
    .update(forumPosts)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(eq(forumPosts.id, id))

  // 只有原本是 published 的才需要减计数
  if (post.status === 'published') {
    await db
      .update(forumTopics)
      .set({ replyCount: sql`greatest(${forumTopics.replyCount} - 1, 0)` })
      .where(eq(forumTopics.id, post.topicId))
  }

  return ok(c, { ok: true })
})
