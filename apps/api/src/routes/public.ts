/**
 * 公开接口 — 无需登录，供官网前端消费。
 *
 * 所有查询强制限定 status = 'published'，草稿绝不会泄漏到前台。
 */

import { Hono } from 'hono'
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm'
import type { Category, ContentStatus } from '@school/shared'
import { getDb } from '../db/client'
import { announcements, articles, categories, messages, pages } from '../db/schema'
import { getSettings } from '../lib/settings-service'
import { fail, iso, ok, parseIntParam, parseBoolParam, readJson } from '../lib/utils'

export const publicRoutes = new Hono()

/* ------------------------------------------------------------------ */
/* 序列化                                                              */
/* ------------------------------------------------------------------ */

function serializeCategory(row: typeof categories.$inferSelect, articleCount?: number): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    ...(articleCount === undefined ? {} : { articleCount }),
  }
}

function serializeArticle(
  row: typeof articles.$inferSelect,
  category?: typeof categories.$inferSelect | null,
) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt,
    coverImage: row.coverImage,
    categoryId: row.categoryId,
    status: row.status as ContentStatus,
    featured: row.featured,
    views: row.views,
    author: row.author,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    category: category ? serializeCategory(category) : null,
  }
}

/* ------------------------------------------------------------------ */
/* 站点设置                                                            */
/* ------------------------------------------------------------------ */

publicRoutes.get('/settings', async (c) => {
  return ok(c, await getSettings())
})

/* ------------------------------------------------------------------ */
/* 导航（分类 + 单页，一次请求拿全，减少前台首屏请求数）               */
/* ------------------------------------------------------------------ */

publicRoutes.get('/navigation', async (c) => {
  const db = getDb()
  const [cats, navPages, config] = await Promise.all([
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id)),
    db
      .select()
      .from(pages)
      .where(and(eq(pages.status, 'published'), eq(pages.showInNav, true)))
      .orderBy(asc(pages.sortOrder), asc(pages.id)),
    getSettings(),
  ])

  return ok(c, {
    categories: config.showCategories ? cats.map((row) => serializeCategory(row)) : [],
    pages: navPages.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      sortOrder: row.sortOrder,
    })),
    siteName: config.siteName,
  })
})

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */

publicRoutes.get('/categories', async (c) => {
  const db = getDb()
  // 只统计已发布文章数，避免分类上显示虚假的条数
  const rows = await db
    .select({
      category: categories,
      articleCount: count(articles.id),
    })
    .from(categories)
    .leftJoin(
      articles,
      and(eq(articles.categoryId, categories.id), eq(articles.status, 'published')),
    )
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.id))

  return ok(c, rows.map(({ category, articleCount }) => serializeCategory(category, Number(articleCount))))
})

/* ------------------------------------------------------------------ */
/* 文章列表                                                            */
/* ------------------------------------------------------------------ */

publicRoutes.get('/articles', async (c) => {
  const db = getDb()
  const q = c.req.query()

  const page = parseIntParam(q.page, 1, 1, 10_000)
  const pageSize = parseIntParam(q.pageSize, 9, 1, 50)
  const offset = (page - 1) * pageSize
  const featured = parseBoolParam(q.featured)
  const sort = q.sort ?? 'latest'

  const filters = [eq(articles.status, 'published')]

  if (q.category) {
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, q.category))
      .limit(1)
    if (cat.length === 0) {
      return ok(c, { items: [], total: 0, page, pageSize, totalPages: 0 })
    }
    filters.push(eq(articles.categoryId, cat[0].id))
  }

  if (q.search) {
    const term = `%${q.search.trim()}%`
    const searchClause = or(ilike(articles.title, term), ilike(articles.excerpt, term))
    if (searchClause) filters.push(searchClause)
  }

  if (featured !== undefined) filters.push(eq(articles.featured, featured))

  const where = and(...filters)

  const orderBy = (() => {
    switch (sort) {
      case 'oldest':
        return [asc(articles.publishedAt), asc(articles.id)]
      case 'popular':
        return [desc(articles.views), desc(articles.id)]
      case 'title':
        return [asc(articles.title)]
      default:
        return [desc(articles.publishedAt), desc(articles.id)]
    }
  })()

  // 置顶文章始终排在最前（除按标题排序外）
  const finalOrder = sort === 'title' ? orderBy : [desc(articles.featured), ...orderBy]

  const [rows, totalRows] = await Promise.all([
    db
      .select({ article: articles, category: categories })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(where)
      .orderBy(...finalOrder)
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(articles).where(where),
  ])

  const total = Number(totalRows[0]?.value ?? 0)

  return ok(c, {
    items: rows.map(({ article, category }) => serializeArticle(article, category)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
})

/* ------------------------------------------------------------------ */
/* 文章详情                                                            */
/* ------------------------------------------------------------------ */

publicRoutes.get('/articles/:slug', async (c) => {
  const db = getDb()
  const slug = c.req.param('slug')

  const rows = await db
    .select({ article: articles, category: categories })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.slug, slug), eq(articles.status, 'published')))
    .limit(1)

  if (rows.length === 0) {
    return fail(c, 404, 'not_found', '文章不存在或尚未发布')
  }

  const { article, category } = rows[0]

  // 浏览量自增，失败不影响正文返回
  try {
    await db
      .update(articles)
      .set({ views: sql`${articles.views} + 1` })
      .where(eq(articles.id, article.id))
  } catch {
    /* 忽略计数失败 */
  }

  // 同分类下的相关文章
  const related = article.categoryId
    ? await db
        .select({
          id: articles.id,
          title: articles.title,
          slug: articles.slug,
          publishedAt: articles.publishedAt,
        })
        .from(articles)
        .where(
          and(
            eq(articles.status, 'published'),
            eq(articles.categoryId, article.categoryId),
            sql`${articles.id} <> ${article.id}`,
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(5)
    : []

  return ok(c, {
    ...serializeArticle({ ...article, views: article.views + 1 }, category),
    related: related.map((r) => ({ ...r, publishedAt: iso(r.publishedAt) })),
  })
})

/* ------------------------------------------------------------------ */
/* 公告                                                                */
/* ------------------------------------------------------------------ */

publicRoutes.get('/announcements', async (c) => {
  const db = getDb()
  const now = new Date()
  const limit = parseIntParam(c.req.query('limit'), 20, 1, 100)

  const where = and(
    eq(announcements.status, 'published'),
    // 未到开始时间或已过结束时间的公告不展示
    or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
    or(isNull(announcements.endsAt), gte(announcements.endsAt, now)),
  )

  const rows = await db
    .select()
    .from(announcements)
    .where(where)
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(limit)

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

/* ------------------------------------------------------------------ */
/* 单页                                                                */
/* ------------------------------------------------------------------ */

publicRoutes.get('/pages/:slug', async (c) => {
  const db = getDb()
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, c.req.param('slug')), eq(pages.status, 'published')))
    .limit(1)

  if (rows.length === 0) {
    return fail(c, 404, 'not_found', '页面不存在')
  }

  const row = rows[0]
  return ok(c, {
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
  })
})

/* ------------------------------------------------------------------ */
/* 首页聚合（一次请求拿全首页所需数据）                                */
/* ------------------------------------------------------------------ */

publicRoutes.get('/home', async (c) => {
  const db = getDb()
  const config = await getSettings()
  const now = new Date()

  const [featured, latest, announcementRows, cats] = await Promise.all([
    config.showFeaturedArticles
      ? db
          .select({ article: articles, category: categories })
          .from(articles)
          .leftJoin(categories, eq(articles.categoryId, categories.id))
          .where(and(eq(articles.status, 'published'), eq(articles.featured, true)))
          .orderBy(desc(articles.publishedAt))
          .limit(config.featuredCount)
      : Promise.resolve([]),

    db
      .select({ article: articles, category: categories })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(eq(articles.status, 'published'))
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(8),

    db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.status, 'published'),
          or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
          or(isNull(announcements.endsAt), gte(announcements.endsAt, now)),
        ),
      )
      .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
      .limit(6),

    config.showCategories
      ? db
          .select({ category: categories, articleCount: count(articles.id) })
          .from(categories)
          .leftJoin(
            articles,
            and(eq(articles.categoryId, categories.id), eq(articles.status, 'published')),
          )
          .groupBy(categories.id)
          .orderBy(asc(categories.sortOrder), asc(categories.id))
      : Promise.resolve([]),
  ])

  return ok(c, {
    settings: config,
    featured: featured.map(({ article, category }) => serializeArticle(article, category)),
    latest: latest.map(({ article, category }) => serializeArticle(article, category)),
    announcements: announcementRows.map((row) => ({
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
    categories: cats.map(({ category, articleCount }) =>
      serializeCategory(category, Number(articleCount)),
    ),
  })
})

/* ------------------------------------------------------------------ */
/* 留言提交（公开写接口，带简单校验）                                  */
/* ------------------------------------------------------------------ */

publicRoutes.post('/messages', async (c) => {
  const body = await readJson<Record<string, unknown>>(c)
  if (!body) return fail(c, 400, 'invalid_body', '请求格式不正确')

  const name = String(body.name ?? '').trim()
  const content = String(body.content ?? '').trim()
  const email = body.email ? String(body.email).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null
  const subject = body.subject ? String(body.subject).trim() : null

  if (!name || name.length > 100) {
    return fail(c, 400, 'invalid_name', '请填写姓名（不超过 100 字）')
  }
  if (!content || content.length > 5000) {
    return fail(c, 400, 'invalid_content', '请填写留言内容（不超过 5000 字）')
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(c, 400, 'invalid_email', '邮箱格式不正确')
  }

  const db = getDb()
  await db.insert(messages).values({ name, content, email, phone, subject })

  return ok(c, { ok: true }, 201)
})
