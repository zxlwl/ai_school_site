/**
 * 数据库 Schema（Drizzle ORM / PostgreSQL）
 *
 * 全部表结构集中在此，改完执行 `pnpm db:push` 同步到数据库。
 * 字段命名：TS 用 camelCase，数据库用 snake_case。
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ */
/* 管理员                                                              */
/* ------------------------------------------------------------------ */

export const admins = pgTable(
  'admins',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 64 }).notNull(),
    /** bcrypt 哈希，绝不存明文 */
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 64 }).notNull().default('管理员'),
    /** 仍使用初始密码时为 true，后台会持续提示修改 */
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('admins_username_idx').on(table.username)],
)

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 16 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('categories_slug_idx').on(table.slug)],
)

/* ------------------------------------------------------------------ */
/* 文章                                                                */
/* ------------------------------------------------------------------ */

export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    content: text('content').notNull().default(''),
    excerpt: text('excerpt'),
    coverImage: text('cover_image'),
    categoryId: integer('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    /** 'draft' | 'published' */
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    views: integer('views').notNull().default(0),
    author: varchar('author', { length: 100 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('articles_slug_idx').on(table.slug),
    index('articles_status_idx').on(table.status),
    index('articles_category_idx').on(table.categoryId),
    index('articles_published_idx').on(table.publishedAt),
  ],
)

/* ------------------------------------------------------------------ */
/* 公告                                                                */
/* ------------------------------------------------------------------ */

export const announcements = pgTable(
  'announcements',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull().default(''),
    /** 'info' | 'important' | 'urgent' */
    level: varchar('level', { length: 16 }).notNull().default('info'),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    pinned: boolean('pinned').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('announcements_status_idx').on(table.status),
    index('announcements_pinned_idx').on(table.pinned),
  ],
)

/* ------------------------------------------------------------------ */
/* 单页                                                                */
/* ------------------------------------------------------------------ */

export const pages = pgTable(
  'pages',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    /** 页面摘要，用于列表与 SEO 描述 */
    summary: text('summary'),
    content: text('content').notNull().default(''),
    status: varchar('status', { length: 16 }).notNull().default('published'),
    showInNav: boolean('show_in_nav').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('pages_slug_idx').on(table.slug)],
)

/* ------------------------------------------------------------------ */
/* 站点设置（单行键值表，key 固定为 'site'）                            */
/* ------------------------------------------------------------------ */

export const settings = pgTable('settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  /** 完整 SiteSettings JSON，读取时与默认值深合并，保证向前兼容 */
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/* ------------------------------------------------------------------ */
/* 媒体文件                                                            */
/* ------------------------------------------------------------------ */

export const media = pgTable(
  'media',
  {
    id: serial('id').primaryKey(),
    filename: varchar('filename', { length: 255 }).notNull(),
    url: text('url').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    bytes: integer('bytes').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('media_created_idx').on(table.createdAt)],
)

/* ------------------------------------------------------------------ */
/* 留言 / 咨询                                                         */
/* ------------------------------------------------------------------ */

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 200 }),
    phone: varchar('phone', { length: 50 }),
    subject: varchar('subject', { length: 255 }),
    content: text('content').notNull(),
    /** 是否已在后台处理 */
    handled: boolean('handled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_handled_idx').on(table.handled)],
)

/* ------------------------------------------------------------------ */
/* 类型导出                                                             */
/* ------------------------------------------------------------------ */

export type AdminRow = typeof admins.$inferSelect
export type CategoryRow = typeof categories.$inferSelect
export type ArticleRow = typeof articles.$inferSelect
export type AnnouncementRow = typeof announcements.$inferSelect
export type PageRow = typeof pages.$inferSelect
export type SettingsRow = typeof settings.$inferSelect
export type MediaRow = typeof media.$inferSelect
export type MessageRow = typeof messages.$inferSelect
