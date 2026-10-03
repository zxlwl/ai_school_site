/**
 * 后台管理接口 — 全部需要登录。
 *
 * 包含：文章 / 分类 / 公告 / 单页 / 站点设置 / 媒体 / 留言 / 仪表盘统计。
 * 与公开接口的区别：不受 status 限制，可增删改。
 */

import { Hono } from 'hono'
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { ContentStatus } from '@school/shared'
import { deriveExcerpt } from '@school/shared'
import { getDb } from '../db/client'
import {
  announcements,
  articles,
  categories,
  media,
  messages,
  pages,
} from '../db/schema'
import { getSettings, updateSettings } from '../lib/settings-service'
import {
  fail,
  iso,
  makeSlug,
  ok,
  parseDate,
  parseIntParam,
  readJson,
  uniqueSlug,
} from '../lib/utils'
import { requireAuth, type AppBindings } from '../middleware/auth'

export const adminRoutes = new Hono<AppBindings>()

// 所有后台接口统一要求登录
adminRoutes.use('*', requireAuth)

/* ------------------------------------------------------------------ */
/* 校验辅助                                                            */
/* ------------------------------------------------------------------ */

function badRequest(c: Parameters<typeof fail>[0], message: string) {
  return fail(c, 400, 'validation_error', message)
}

function normalizeStatus(value: unknown, fallback: ContentStatus = 'draft'): ContentStatus {
  return value === 'published' || value === 'draft' ? value : fallback
}

/** 校验十六进制颜色，非法值返回 null */
function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : null
}

/* ================================================================== */
/* 仪表盘统计                                                          */
/* ================================================================== */

adminRoutes.get('/stats', async (c) => {
  const db = getDb()

  const [articleAgg, announcementAgg, categoryAgg, pageAgg, messageAgg, recent] = await Promise.all([
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${articles.status} = 'published')`,
        draft: sql<number>`count(*) filter (where ${articles.status} = 'draft')`,
        views: sql<number>`coalesce(sum(${articles.views}), 0)`,
      })
      .from(articles),
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${announcements.status} = 'published')`,
        draft: sql<number>`count(*) filter (where ${announcements.status} = 'draft')`,
      })
      .from(announcements),
    db.select({ total: count() }).from(categories),
    db.select({ total: count() }).from(pages),
    db
      .select({
        total: count(),
        pending: sql<number>`count(*) filter (where ${messages.handled} = false)`,
      })
      .from(messages),
    db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        status: articles.status,
        views: articles.views,
        featured: articles.featured,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
        categoryName: categories.name,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .orderBy(desc(articles.createdAt))
      .limit(5),
  ])

  const a = articleAgg[0]
  const n = announcementAgg[0]
  const m = messageAgg[0]

  return ok(c, {
    articles: {
      total: Number(a?.total ?? 0),
      published: Number(a?.published ?? 0),
      draft: Number(a?.draft ?? 0),
      views: Number(a?.views ?? 0),
    },
    announcements: {
      total: Number(n?.total ?? 0),
      published: Number(n?.published ?? 0),
      draft: Number(n?.draft ?? 0),
    },
    categories: Number(categoryAgg[0]?.total ?? 0),
    pages: Number(pageAgg[0]?.total ?? 0),
    messages: {
      total: Number(m?.total ?? 0),
      pending: Number(m?.pending ?? 0),
    },
    recentArticles: recent.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status as ContentStatus,
      views: row.views,
      featured: row.featured,
      publishedAt: iso(row.publishedAt),
      createdAt: iso(row.createdAt)!,
      categoryName: row.categoryName ?? null,
    })),
  })
})

/* ================================================================== */
/* 文章                                                                */
/* ================================================================== */

adminRoutes.get('/articles', async (c) => {
  const db = getDb()
  const q = c.req.query()

  const page = parseIntParam(q.page, 1, 1, 10_000)
  const pageSize = parseIntParam(q.pageSize, 20, 1, 100)
  const offset = (page - 1) * pageSize

  const filters = []
  if (q.status === 'draft' || q.status === 'published') {
    filters.push(eq(articles.status, q.status))
  }
  if (q.category) {
    const parsed = Number.parseInt(q.category, 10)
    if (!Number.isNaN(parsed)) filters.push(eq(articles.categoryId, parsed))
  }
  if (q.search) {
    const term = `%${q.search.trim()}%`
    const clause = or(ilike(articles.title, term), ilike(articles.excerpt, term))
    if (clause) filters.push(clause)
  }

  const where = filters.length > 0 ? and(...filters) : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select({ article: articles, category: categories })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(where)
      .orderBy(desc(articles.updatedAt), desc(articles.id))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(articles).where(where),
  ])

  const total = Number(totalRows[0]?.value ?? 0)

  return ok(c, {
    items: rows.map(({ article, category }) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      // 列表不返回完整正文，减小响应体积
      excerpt: article.excerpt,
      coverImage: article.coverImage,
      categoryId: article.categoryId,
      status: article.status as ContentStatus,
      featured: article.featured,
      views: article.views,
      author: article.author,
      publishedAt: iso(article.publishedAt),
      createdAt: iso(article.createdAt)!,
      updatedAt: iso(article.updatedAt)!,
      category: category
        ? {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            color: category.color,
            sortOrder: category.sortOrder,
            createdAt: iso(category.createdAt)!,
            updatedAt: iso(category.updatedAt)!,
          }
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
})

/** 编辑页需要完整正文，单独取单条 */
adminRoutes.get('/articles/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的文章 ID')

  const rows = await db
    .select({ article: articles, category: categories })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.id, id))
    .limit(1)

  if (rows.length === 0) return fail(c, 404, 'not_found', '文章不存在')

  const { article, category } = rows[0]
  return ok(c, {
    ...article,
    publishedAt: iso(article.publishedAt),
    createdAt: iso(article.createdAt)!,
    updatedAt: iso(article.updatedAt)!,
    category: category
      ? {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          color: category.color,
          sortOrder: category.sortOrder,
          createdAt: iso(category.createdAt)!,
          updatedAt: iso(category.updatedAt)!,
        }
      : null,
  })
})

adminRoutes.post('/articles', async (c) => {
  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const title = String(body.title ?? '').trim()
  const content = String(body.content ?? '')
  if (!title) return badRequest(c, '标题不能为空')
  if (title.length > 255) return badRequest(c, '标题不能超过 255 字')

  const status = normalizeStatus(body.status, 'draft')
  const db = getDb()

  const slug = await uniqueSlug(makeSlug(title, body.slug as string | undefined), async (candidate) => {
    const hit = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidate))
      .limit(1)
    return hit.length > 0
  })

  // 分类需真实存在，否则外键会报错
  let categoryId: number | null = null
  if (body.categoryId !== null && body.categoryId !== undefined && body.categoryId !== '') {
    const parsed = Number(body.categoryId)
    if (!Number.isNaN(parsed)) {
      const hit = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, parsed))
        .limit(1)
      categoryId = hit.length > 0 ? parsed : null
    }
  }

  const publishedAt =
    parseDate(body.publishedAt) ?? (status === 'published' ? new Date() : null)

  const excerpt =
    typeof body.excerpt === 'string' && body.excerpt.trim()
      ? body.excerpt.trim()
      : deriveExcerpt(content)

  const inserted = await db
    .insert(articles)
    .values({
      title,
      slug,
      content,
      excerpt,
      coverImage: typeof body.coverImage === 'string' && body.coverImage.trim() ? body.coverImage.trim() : null,
      categoryId,
      status,
      featured: Boolean(body.featured),
      author: typeof body.author === 'string' && body.author.trim() ? body.author.trim() : null,
      publishedAt,
    })
    .returning({ id: articles.id, slug: articles.slug })

  return ok(c, inserted[0], 201)
})

adminRoutes.put('/articles/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的文章 ID')

  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const existing = await db.select().from(articles).where(eq(articles.id, id)).limit(1)
  if (existing.length === 0) return fail(c, 404, 'not_found', '文章不存在')
  const current = existing[0]

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) return badRequest(c, '标题不能为空')
    if (title.length > 255) return badRequest(c, '标题不能超过 255 字')
    patch.title = title
  }

  if (body.slug !== undefined) {
    const raw = String(body.slug).trim()
    const desired = makeSlug(String(patch.title ?? current.title), raw)
    if (desired !== current.slug) {
      patch.slug = await uniqueSlug(desired, async (candidate) => {
        const hit = await db
          .select({ id: articles.id })
          .from(articles)
          .where(and(eq(articles.slug, candidate), sql`${articles.id} <> ${id}`))
          .limit(1)
        return hit.length > 0
      })
    }
  }

  if (body.content !== undefined) {
    const content = String(body.content)
    patch.content = content
    // 未手动指定摘要时自动重算
    if (body.excerpt === undefined) patch.excerpt = deriveExcerpt(content)
  }

  if (body.excerpt !== undefined) {
    patch.excerpt =
      typeof body.excerpt === 'string' && body.excerpt.trim() ? body.excerpt.trim() : null
  }

  if (body.coverImage !== undefined) {
    patch.coverImage =
      typeof body.coverImage === 'string' && body.coverImage.trim() ? body.coverImage.trim() : null
  }

  if (body.author !== undefined) {
    patch.author =
      typeof body.author === 'string' && body.author.trim() ? body.author.trim() : null
  }

  if (body.featured !== undefined) patch.featured = Boolean(body.featured)

  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === '') {
      patch.categoryId = null
    } else {
      const parsed = Number(body.categoryId)
      const hit = Number.isNaN(parsed)
        ? []
        : await db.select({ id: categories.id }).from(categories).where(eq(categories.id, parsed)).limit(1)
      patch.categoryId = hit.length > 0 ? parsed : null
    }
  }

  if (body.status !== undefined) {
    const status = normalizeStatus(body.status, current.status as ContentStatus)
    patch.status = status
    // 首次发布时补上发布时间，避免前台排序出现 null
    if (status === 'published' && !current.publishedAt) {
      patch.publishedAt = parseDate(body.publishedAt) ?? new Date()
    }
  }

  if (body.publishedAt !== undefined) {
    patch.publishedAt = parseDate(body.publishedAt)
  }

  await db.update(articles).set(patch).where(eq(articles.id, id))
  return ok(c, { ok: true })
})

adminRoutes.delete('/articles/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的文章 ID')

  const deleted = await db.delete(articles).where(eq(articles.id, id)).returning({ id: articles.id })
  if (deleted.length === 0) return fail(c, 404, 'not_found', '文章不存在')

  return ok(c, { ok: true })
})

/** 批量删除，后台列表多选后一次调用 */
adminRoutes.post('/articles/batch-delete', async (c) => {
  const body = await readJson<{ ids?: unknown }>(c)
  const raw = Array.isArray(body?.ids) ? body.ids : []
  const ids = raw.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)

  if (ids.length === 0) return badRequest(c, '请提供要删除的文章 ID')
  if (ids.length > 200) return badRequest(c, '单次最多删除 200 篇')

  const db = getDb()
  const deleted = await db
    .delete(articles)
    .where(sql`${articles.id} in ${ids}`)
    .returning({ id: articles.id })

  return ok(c, { ok: true, deleted: deleted.length })
})

/* ================================================================== */
/* 分类                                                                */
/* ================================================================== */

adminRoutes.get('/categories', async (c) => {
  const db = getDb()
  const rows = await db
    .select({ category: categories, articleCount: count(articles.id) })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.id))

  return ok(
    c,
    rows.map(({ category, articleCount }) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      color: category.color,
      sortOrder: category.sortOrder,
      createdAt: iso(category.createdAt)!,
      updatedAt: iso(category.updatedAt)!,
      articleCount: Number(articleCount),
    })),
  )
})

adminRoutes.post('/categories', async (c) => {
  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const name = String(body.name ?? '').trim()
  if (!name) return badRequest(c, '分类名称不能为空')
  if (name.length > 100) return badRequest(c, '分类名称不能超过 100 字')

  const db = getDb()
  const slug = await uniqueSlug(makeSlug(name, body.slug as string | undefined), async (candidate) => {
    const hit = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, candidate))
      .limit(1)
    return hit.length > 0
  })

  const inserted = await db
    .insert(categories)
    .values({
      name,
      slug,
      description:
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
      color: normalizeColor(body.color),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    })
    .returning({ id: categories.id, slug: categories.slug })

  return ok(c, inserted[0], 201)
})

adminRoutes.put('/categories/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的分类 ID')

  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const existing = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  if (existing.length === 0) return fail(c, 404, 'not_found', '分类不存在')
  const current = existing[0]

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return badRequest(c, '分类名称不能为空')
    patch.name = name.slice(0, 100)
  }

  if (body.slug !== undefined) {
    const desired = makeSlug(String(patch.name ?? current.name), String(body.slug))
    if (desired !== current.slug) {
      patch.slug = await uniqueSlug(desired, async (candidate) => {
        const hit = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.slug, candidate), sql`${categories.id} <> ${id}`))
          .limit(1)
        return hit.length > 0
      })
    }
  }

  if (body.description !== undefined) {
    patch.description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null
  }

  if (body.color !== undefined) patch.color = normalizeColor(body.color)
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    patch.sortOrder = Number(body.sortOrder)
  }

  await db.update(categories).set(patch).where(eq(categories.id, id))
  return ok(c, { ok: true })
})

/** 删除分类：关联文章的分类置空（外键 onDelete: set null），文章本身保留 */
adminRoutes.delete('/categories/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的分类 ID')

  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id })
  if (deleted.length === 0) return fail(c, 404, 'not_found', '分类不存在')

  return ok(c, { ok: true })
})

/* ================================================================== */
/* 公告                                                                */
/* ================================================================== */

adminRoutes.get('/announcements', async (c) => {
  const db = getDb()
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))

  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      level: row.level,
      status: row.status as ContentStatus,
      pinned: row.pinned,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt)!,
    })),
  )
})

adminRoutes.post('/announcements', async (c) => {
  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const title = String(body.title ?? '').trim()
  if (!title) return badRequest(c, '公告标题不能为空')
  if (title.length > 255) return badRequest(c, '标题不能超过 255 字')

  const level = ['info', 'important', 'urgent'].includes(String(body.level))
    ? String(body.level)
    : 'info'

  const db = getDb()
  const inserted = await db
    .insert(announcements)
    .values({
      title,
      content: String(body.content ?? ''),
      level,
      status: normalizeStatus(body.status, 'draft'),
      pinned: Boolean(body.pinned),
      startsAt: parseDate(body.startsAt),
      endsAt: parseDate(body.endsAt),
    })
    .returning({ id: announcements.id })

  return ok(c, inserted[0], 201)
})

adminRoutes.put('/announcements/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的公告 ID')

  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const existing = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1)
  if (existing.length === 0) return fail(c, 404, 'not_found', '公告不存在')

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) return badRequest(c, '公告标题不能为空')
    patch.title = title.slice(0, 255)
  }
  if (body.content !== undefined) patch.content = String(body.content)
  if (body.status !== undefined) patch.status = normalizeStatus(body.status)
  if (body.pinned !== undefined) patch.pinned = Boolean(body.pinned)
  if (body.level !== undefined && ['info', 'important', 'urgent'].includes(String(body.level))) {
    patch.level = String(body.level)
  }
  if (body.startsAt !== undefined) patch.startsAt = parseDate(body.startsAt)
  if (body.endsAt !== undefined) patch.endsAt = parseDate(body.endsAt)

  await db.update(announcements).set(patch).where(eq(announcements.id, id))
  return ok(c, { ok: true })
})

adminRoutes.delete('/announcements/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的公告 ID')

  const deleted = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id })
  if (deleted.length === 0) return fail(c, 404, 'not_found', '公告不存在')

  return ok(c, { ok: true })
})

/* ================================================================== */
/* 单页                                                                */
/* ================================================================== */

adminRoutes.get('/pages', async (c) => {
  const db = getDb()
  const rows = await db
    .select()
    .from(pages)
    .orderBy(asc(pages.sortOrder), asc(pages.id))

  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      content: row.content,
      status: row.status as ContentStatus,
      showInNav: row.showInNav,
      sortOrder: row.sortOrder,
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt)!,
    })),
  )
})

adminRoutes.post('/pages', async (c) => {
  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const title = String(body.title ?? '').trim()
  if (!title) return badRequest(c, '页面标题不能为空')

  const db = getDb()
  const slug = await uniqueSlug(makeSlug(title, body.slug as string | undefined), async (candidate) => {
    const hit = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, candidate)).limit(1)
    return hit.length > 0
  })

  const inserted = await db
    .insert(pages)
    .values({
      title: title.slice(0, 255),
      slug,
      summary: body.summary === undefined || body.summary === null ? null : String(body.summary),
      content: String(body.content ?? ''),
      status: normalizeStatus(body.status, 'published'),
      showInNav: body.showInNav === undefined ? true : Boolean(body.showInNav),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    })
    .returning({ id: pages.id, slug: pages.slug })

  return ok(c, inserted[0], 201)
})

adminRoutes.put('/pages/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的页面 ID')

  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const existing = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
  if (existing.length === 0) return fail(c, 404, 'not_found', '页面不存在')
  const current = existing[0]

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) return badRequest(c, '页面标题不能为空')
    patch.title = title.slice(0, 255)
  }
  if (body.slug !== undefined) {
    const desired = makeSlug(String(patch.title ?? current.title), String(body.slug))
    if (desired !== current.slug) {
      patch.slug = await uniqueSlug(desired, async (candidate) => {
        const hit = await db
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.slug, candidate), sql`${pages.id} <> ${id}`))
          .limit(1)
        return hit.length > 0
      })
    }
  }
  if (body.summary !== undefined) {
    patch.summary = body.summary === null ? null : String(body.summary)
  }
  if (body.content !== undefined) patch.content = String(body.content)
  if (body.status !== undefined) patch.status = normalizeStatus(body.status, 'published')
  if (body.showInNav !== undefined) patch.showInNav = Boolean(body.showInNav)
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    patch.sortOrder = Number(body.sortOrder)
  }

  await db.update(pages).set(patch).where(eq(pages.id, id))
  return ok(c, { ok: true })
})

adminRoutes.delete('/pages/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的页面 ID')

  const deleted = await db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id })
  if (deleted.length === 0) return fail(c, 404, 'not_found', '页面不存在')

  return ok(c, { ok: true })
})

/* ================================================================== */
/* 站点设置（含主题）                                                   */
/* ================================================================== */

adminRoutes.get('/settings', async (c) => {
  return ok(c, await getSettings())
})

adminRoutes.put('/settings', async (c) => {
  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return badRequest(c, '请求格式不正确')

  const next = await updateSettings(body)
  return ok(c, next)
})

/** 重置主题为某个预设，返回完整设置 */
adminRoutes.post('/settings/theme/reset', async (c) => {
  const body = await readJson<{ preset?: string }>(c)
  const presetId = body?.preset ?? 'academic-blue'

  const { THEME_PRESETS } = await import('@school/shared')
  const preset = THEME_PRESETS.find((p) => p.id === presetId)
  if (!preset) return badRequest(c, '未知的主题预设')

  const next = await updateSettings({ theme: { preset: preset.id, ...preset.colors } })
  return ok(c, next)
})

/* ================================================================== */
/* 媒体                                                                */
/* ================================================================== */

adminRoutes.get('/media', async (c) => {
  const db = getDb()
  const limit = parseIntParam(c.req.query('limit'), 60, 1, 200)
  const rows = await db.select().from(media).orderBy(desc(media.createdAt)).limit(limit)

  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      url: row.url,
      mimeType: row.mimeType,
      bytes: row.bytes,
      createdAt: iso(row.createdAt)!,
    })),
  )
})

adminRoutes.delete('/media/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的媒体 ID')

  const deleted = await db.delete(media).where(eq(media.id, id)).returning({ id: media.id })
  if (deleted.length === 0) return fail(c, 404, 'not_found', '媒体不存在')

  return ok(c, { ok: true })
})

/* ================================================================== */
/* 留言                                                                */
/* ================================================================== */

adminRoutes.get('/messages', async (c) => {
  const db = getDb()
  const page = parseIntParam(c.req.query('page'), 1, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = parseIntParam(c.req.query('pageSize'), 20, 1, 100)
  const handledParam = c.req.query('handled')
  const search = c.req.query('search')?.trim()

  const filters = []
  if (handledParam === 'true' || handledParam === 'false') {
    filters.push(eq(messages.handled, handledParam === 'true'))
  }
  if (search) {
    filters.push(
      or(
        ilike(messages.name, `%${search}%`),
        ilike(messages.content, `%${search}%`),
        ilike(messages.subject, `%${search}%`),
      )!,
    )
  }
  const where = filters.length > 0 ? and(...filters) : undefined

  const [rows, totalAgg] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(messages).where(where),
  ])

  const total = Number(totalAgg[0]?.total ?? 0)

  return ok(c, {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      content: row.content,
      isHandled: row.handled,
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt)!,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

adminRoutes.put('/messages/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的留言 ID')

  const body = await readJson<{ isHandled?: unknown }>(c)
  await db
    .update(messages)
    .set({ handled: Boolean(body?.isHandled), updatedAt: new Date() })
    .where(eq(messages.id, id))

  return ok(c, { ok: true })
})

adminRoutes.delete('/messages/:id', async (c) => {
  const db = getDb()
  const id = Number.parseInt(c.req.param('id'), 10)
  if (Number.isNaN(id)) return badRequest(c, '无效的留言 ID')

  const deleted = await db.delete(messages).where(eq(messages.id, id)).returning({ id: messages.id })
  if (deleted.length === 0) return fail(c, 404, 'not_found', '留言不存在')

  return ok(c, { ok: true })
})
