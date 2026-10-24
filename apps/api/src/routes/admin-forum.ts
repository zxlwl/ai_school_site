/**
 * 论坛管理接口 — 挂在 /api/admin/forum。
 *
 * 权限分层：
 *   viewer   可读（含 pending / hidden 的帖子，便于了解现状）
 *   editor+  可写（版块增删改、主题置顶锁定隐藏、回复隐藏）
 *
 * 与 admin.ts 一样，写权限按 HTTP 方法统一判定，避免逐路由挂守卫时漏挂。
 */

import { Hono } from 'hono'
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import type { ForumPostPolicy, ForumTopicStatus } from '@school/shared'
import { getDb } from '../db/client'
import { forumBoards, forumPosts, forumTopics, users } from '../db/schema'
import { fail, iso, makeSlug, ok, parseIntParam, readJson, uniqueSlug } from '../lib/utils'
import { requireAuth, type AppBindings } from '../middleware/auth'
import { canWriteContent } from '@school/shared'

export const adminForumRoutes = new Hono<AppBindings>()

/* ------------------------------------------------------------------ */
/* 读放行、写要求可写角色                                              */
/* ------------------------------------------------------------------ */

adminForumRoutes.use('*', requireAuth)

adminForumRoutes.use('*', async (c, next) => {
  const method = c.req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next()

  const session = c.get('session')
  if (!canWriteContent(session.role)) {
    return fail(c, 403, 'forbidden', '当前账号为只读角色，无法修改论坛内容')
  }
  return next()
})

/* ------------------------------------------------------------------ */
/* 版块管理                                                            */
/* ------------------------------------------------------------------ */

adminForumRoutes.get('/boards', async (c) => {
  const db = getDb()

  const boards = await db
    .select()
    .from(forumBoards)
    .orderBy(asc(forumBoards.sortOrder), asc(forumBoards.id))

  // 统计每个版块的主题数（含未发布的，管理端要看全量）
  const stats = await db
    .select({ boardId: forumTopics.boardId, topicCount: count() })
    .from(forumTopics)
    .groupBy(forumTopics.boardId)

  const statMap = new Map(stats.map((s) => [s.boardId, Number(s.topicCount)]))

  return ok(c, {
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      slug: board.slug,
      description: board.description,
      color: board.color,
      sortOrder: board.sortOrder,
      postPolicy: board.postPolicy as ForumPostPolicy,
      needsReview: board.needsReview,
      archived: board.archived,
      createdAt: iso(board.createdAt)!,
      updatedAt: iso(board.updatedAt)!,
      topicCount: statMap.get(board.id) ?? 0,
    })),
  })
})

adminForumRoutes.post('/boards', async (c) => {
  const db = getDb()
  const body = await readJson<{
    name?: string
    slug?: string
    description?: string | null
    color?: string | null
    sortOrder?: number
    postPolicy?: ForumPostPolicy
    needsReview?: boolean
  }>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const name = String(body.name ?? '').trim()
  if (!name) return fail(c, 400, 'invalid_name', '请填写版块名称')
  if (name.length > 60) return fail(c, 400, 'invalid_name', '版块名称最多 60 个字')

  const desired = makeSlug(name, body.slug ?? null)
  const slug = await uniqueSlug(desired, async (candidate) => {
    const [hit] = await db
      .select({ id: forumBoards.id })
      .from(forumBoards)
      .where(eq(forumBoards.slug, candidate))
      .limit(1)
    return Boolean(hit)
  })

  const policy: ForumPostPolicy =
    body.postPolicy === 'all' || body.postPolicy === 'staff_only' ? body.postPolicy : 'member_only'

  const [created] = await db
    .insert(forumBoards)
    .values({
      name,
      slug,
      description: body.description ?? null,
      color: body.color ?? null,
      sortOrder: Number(body.sortOrder ?? 0) || 0,
      postPolicy: policy,
      needsReview: Boolean(body.needsReview),
    })
    .returning()

  return ok(c, { board: created }, 201)
})

adminForumRoutes.put('/boards/:id', async (c) => {
  const db = getDb()
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [board] = await db.select().from(forumBoards).where(eq(forumBoards.id, id)).limit(1)
  if (!board) return fail(c, 404, 'not_found', '版块不存在')

  const body = await readJson<{
    name?: string
    description?: string | null
    color?: string | null
    sortOrder?: number
    postPolicy?: ForumPostPolicy
    needsReview?: boolean
    archived?: boolean
  }>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return fail(c, 400, 'invalid_name', '版块名称不能为空')
    patch.name = name
  }
  if (body.description !== undefined) patch.description = body.description
  if (body.color !== undefined) patch.color = body.color
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0
  if (body.postPolicy !== undefined) {
    if (!['all', 'member_only', 'staff_only'].includes(body.postPolicy)) {
      return fail(c, 400, 'invalid_policy', '发帖权限取值不合法')
    }
    patch.postPolicy = body.postPolicy
  }
  if (body.needsReview !== undefined) patch.needsReview = Boolean(body.needsReview)
  if (body.archived !== undefined) patch.archived = Boolean(body.archived)

  const [updated] = await db.update(forumBoards).set(patch).where(eq(forumBoards.id, id)).returning()
  return ok(c, { board: updated })
})

adminForumRoutes.delete('/boards/:id', async (c) => {
  const db = getDb()
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [board] = await db.select().from(forumBoards).where(eq(forumBoards.id, id)).limit(1)
  if (!board) return fail(c, 404, 'not_found', '版块不存在')

  /*
   * 有主题的版块不允许直接删除 —— 外键是 on delete cascade，
   * 一旦删除会把整个版块的主题和回复全部连带删掉。这种不可逆操作
   * 必须先让管理员确认（先归档或手动清空帖子）。
   */
  const [{ n }] = await db
    .select({ n: count() })
    .from(forumTopics)
    .where(eq(forumTopics.boardId, id))

  if (Number(n) > 0) {
    return fail(
      c,
      409,
      'board_not_empty',
      `该版块下还有 ${n} 个主题，请先归档版块或转移主题后再删除`,
    )
  }

  await db.delete(forumBoards).where(eq(forumBoards.id, id))
  return ok(c, { ok: true })
})

/* ------------------------------------------------------------------ */
/* 主题管理                                                            */
/* ------------------------------------------------------------------ */

adminForumRoutes.get('/topics', async (c) => {
  const db = getDb()

  const page = parseIntParam(c.req.query('page'), 1, 1, 100000)
  const pageSize = parseIntParam(c.req.query('pageSize'), 20, 1, 100)
  const statusFilter = c.req.query('status')
  // boardId 是可选筛选条件，没传时不应参与 where
  const boardIdRaw = c.req.query('boardId')
  const boardId =
    boardIdRaw === undefined || boardIdRaw === ''
      ? undefined
      : Number.parseInt(boardIdRaw, 10) || undefined

  const conditions = [sql`${forumTopics.status} <> 'deleted'`]
  if (statusFilter && ['published', 'pending', 'hidden'].includes(statusFilter)) {
    conditions.push(eq(forumTopics.status, statusFilter))
  }
  if (boardId !== undefined) conditions.push(eq(forumTopics.boardId, boardId))

  const where = and(...conditions)

  const rows = await db
    .select({
      topic: forumTopics,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
      board: { id: forumBoards.id, name: forumBoards.name, slug: forumBoards.slug },
    })
    .from(forumTopics)
    .innerJoin(users, eq(forumTopics.authorId, users.id))
    .innerJoin(forumBoards, eq(forumTopics.boardId, forumBoards.id))
    .where(where)
    .orderBy(desc(forumTopics.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ n: total }] = await db.select({ n: count() }).from(forumTopics).where(where)

  return ok(c, {
    topics: rows.map((r) => ({
      id: r.topic.id,
      boardId: r.topic.boardId,
      title: r.topic.title,
      slug: r.topic.slug,
      status: r.topic.status as ForumTopicStatus,
      pinned: r.topic.pinned,
      locked: r.topic.locked,
      views: r.topic.views,
      replyCount: r.topic.replyCount,
      createdAt: iso(r.topic.createdAt)!,
      author: r.author,
      board: r.board,
    })),
    pagination: { page, pageSize, total: Number(total) },
  })
})

adminForumRoutes.patch('/topics/:id', async (c) => {
  const db = getDb()
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, id)).limit(1)
  if (!topic) return fail(c, 404, 'not_found', '主题不存在')

  const body = await readJson<{
    pinned?: boolean
    locked?: boolean
    status?: ForumTopicStatus
    boardId?: number
  }>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.pinned !== undefined) patch.pinned = Boolean(body.pinned)
  if (body.locked !== undefined) patch.locked = Boolean(body.locked)

  if (body.status !== undefined) {
    if (!['published', 'pending', 'hidden', 'deleted'].includes(body.status)) {
      return fail(c, 400, 'invalid_status', '状态取值不合法')
    }
    // 从 pending 转为 published 时，若从来没有过活跃时间，补上
    if (body.status === 'published' && !topic.lastReplyAt) {
      patch.lastReplyAt = topic.createdAt
    }
    patch.status = body.status
  }

  if (body.boardId !== undefined) {
    const target = Number(body.boardId)
    if (!Number.isFinite(target)) return fail(c, 400, 'invalid_board', '版块参数不正确')
    const [board] = await db.select().from(forumBoards).where(eq(forumBoards.id, target)).limit(1)
    if (!board) return fail(c, 404, 'not_found', '目标版块不存在')
    patch.boardId = target
  }

  const [updated] = await db.update(forumTopics).set(patch).where(eq(forumTopics.id, id)).returning()

  return ok(c, {
    topic: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      pinned: updated.pinned,
      locked: updated.locked,
      boardId: updated.boardId,
    },
  })
})

/* ------------------------------------------------------------------ */
/* 回复管理                                                            */
/* ------------------------------------------------------------------ */

adminForumRoutes.get('/topics/:id/posts', async (c) => {
  const db = getDb()
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const rows = await db
    .select({
      post: forumPosts,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.authorId, users.id))
    .where(eq(forumPosts.topicId, id))
    .orderBy(asc(forumPosts.createdAt))

  return ok(c, {
    posts: rows.map((r) => ({
      id: r.post.id,
      content: r.post.content,
      status: r.post.status,
      replyTo: r.post.replyTo,
      createdAt: iso(r.post.createdAt)!,
      author: r.author,
    })),
  })
})

adminForumRoutes.patch('/posts/:id', async (c) => {
  const db = getDb()
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return fail(c, 400, 'invalid_id', '参数不正确')

  const [post] = await db.select().from(forumPosts).where(eq(forumPosts.id, id)).limit(1)
  if (!post) return fail(c, 404, 'not_found', '回复不存在')

  const body = await readJson<{ status?: 'published' | 'hidden' | 'deleted' }>(c)
  if (!body?.status) return fail(c, 400, 'invalid_body', '缺少 status')
  if (!['published', 'hidden', 'deleted'].includes(body.status)) {
    return fail(c, 400, 'invalid_status', '状态取值不合法')
  }

  /*
   * 改可见性 + 同步计数。不能用事务（Neon HTTP 驱动不支持），
   * 先改状态再原子调整计数。
   */
  await db
    .update(forumPosts)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(forumPosts.id, id))

  const wasVisible = post.status === 'published'
  const nowVisible = body.status === 'published'
  if (wasVisible !== nowVisible) {
    await db
      .update(forumTopics)
      .set({
        replyCount: nowVisible
          ? sql`${forumTopics.replyCount} + 1`
          : sql`greatest(${forumTopics.replyCount} - 1, 0)`,
      })
      .where(eq(forumTopics.id, post.topicId))
  }

  return ok(c, { ok: true })
})
