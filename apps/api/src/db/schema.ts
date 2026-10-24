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
    /**
     * 角色：'owner' | 'editor' | 'viewer'
     *
     * 默认给 owner 是为了兼容旧数据 —— 升级前已存在的管理员账号
     * （包括初始的 admin）都应该是超级管理员，否则升级后会有人
     * 突然失去管理账号的权限、把自己锁在门外。
     */
    role: varchar('role', { length: 16 }).notNull().default('owner'),
    /** 停用后无法登录，但记录保留（比直接删除安全，避免误删后无据可查） */
    active: boolean('active').notNull().default(true),
    /** 仍使用初始密码时为 true，后台会持续提示修改 */
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('admins_username_idx').on(table.username),
    index('admins_role_idx').on(table.role),
  ],
)

/* ------------------------------------------------------------------ */
/* 会员账号（前台注册用户）                                            */
/* ------------------------------------------------------------------ */

/**
 * 与 admins 完全分离的两套账号体系：
 * - admins    → 后台 /admin，能改内容
 * - users     → 前台会员，只能管自己的资料，未来用于论坛发帖/评论
 *
 * 分开的原因：权限模型、生命周期、风控要求都不同。混在一张表里
 * 迟早会写出「会员误判为管理员」这类越权漏洞。
 */
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 32 }).notNull(),
    /** 统一小写存储，用于大小写不敏感的唯一性判定 */
    email: varchar('email', { length: 200 }),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    /** 头像：dataurl 或外链 */
    avatar: text('avatar'),
    /** 'member' | 'moderator' */
    role: varchar('role', { length: 16 }).notNull().default('member'),
    /** 'active' | 'muted' | 'banned' */
    status: varchar('status', { length: 16 }).notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_username_idx').on(table.username),
    uniqueIndex('users_email_idx').on(table.email),
    index('users_status_idx').on(table.status),
  ],
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
/* 论坛                                                                */
/* ------------------------------------------------------------------ */

/**
 * 版块。
 *
 * 由管理员创建（不允许用户自建），数量少、结构稳定 —— 这是校内论坛
 * 和通用论坛最重要的区别。开放建版会让结构迅速失控。
 */
export const forumBoards = pgTable(
  'forum_boards',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 60 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 16 }),
    sortOrder: integer('sort_order').notNull().default(0),
    /** 发主题权限：'all' | 'member_only' | 'staff_only' */
    postPolicy: varchar('post_policy', { length: 16 }).notNull().default('member_only'),
    /** true 时新主题进入 pending，需管理员审核后才公开 */
    needsReview: boolean('needs_review').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('forum_boards_slug_idx').on(table.slug)],
)

/**
 * 主题帖。
 *
 * replyCount / lastReplyAt 是冗余字段，在回复的同一个事务里维护，
 * 避免列表页每次都 count(*) —— 论坛列表是最热的查询，不值得为一致性
 * 牺牲这个。
 */
export const forumTopics = pgTable(
  'forum_topics',
  {
    id: serial('id').primaryKey(),
    boardId: integer('board_id')
      .notNull()
      .references(() => forumBoards.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull(),
    /** 首楼正文，冗余一份避免详情页额外 join forum_posts */
    content: text('content').notNull(),
    /** 'published' | 'pending' | 'hidden' | 'deleted' */
    status: varchar('status', { length: 16 }).notNull().default('published'),
    pinned: boolean('pinned').notNull().default(false),
    /** 锁定后不能回复 */
    locked: boolean('locked').notNull().default(false),
    views: integer('views').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    lastReplyAt: timestamp('last_reply_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('forum_topics_slug_idx').on(table.slug),
    index('forum_topics_board_idx').on(table.boardId, table.status, table.lastReplyAt),
    index('forum_topics_author_idx').on(table.authorId),
    index('forum_topics_status_idx').on(table.status),
  ],
)

/**
 * 回复。
 *
 * 用软删除（status='deleted'）而不是物理删除：学生之间闹矛盾时，
 * 删帖证据没了会让处理变得复杂。
 */
export const forumPosts = pgTable(
  'forum_posts',
  {
    id: serial('id').primaryKey(),
    topicId: integer('topic_id')
      .notNull()
      .references(() => forumTopics.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    /** 'published' | 'hidden' | 'deleted' */
    status: varchar('status', { length: 16 }).notNull().default('published'),
    /** 楼中楼：指向被回复的那条 */
    replyTo: integer('reply_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('forum_posts_topic_idx').on(table.topicId, table.status, table.createdAt),
    index('forum_posts_author_idx').on(table.authorId),
  ],
)

/* ------------------------------------------------------------------ */
/* 类型导出                                                             */
/* ------------------------------------------------------------------ */

export type AdminRow = typeof admins.$inferSelect
export type UserRow = typeof users.$inferSelect
export type CategoryRow = typeof categories.$inferSelect
export type ArticleRow = typeof articles.$inferSelect
export type AnnouncementRow = typeof announcements.$inferSelect
export type PageRow = typeof pages.$inferSelect
export type SettingsRow = typeof settings.$inferSelect
export type MediaRow = typeof media.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type ForumBoardRow = typeof forumBoards.$inferSelect
export type ForumTopicRow = typeof forumTopics.$inferSelect
export type ForumPostRow = typeof forumPosts.$inferSelect
