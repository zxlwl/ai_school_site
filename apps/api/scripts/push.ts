/**
 * 建表脚本 — 直接执行 SQL 建表，无需 drizzle-kit 迁移文件。
 *
 * 相比 drizzle-kit push，手写幂等 SQL 的好处是：
 * - 可以在任何 Postgres 上直接跑（Neon / Supabase / 本地 / Docker）
 * - 反复执行不会报错，适合首次部署时手动初始化
 * - 不依赖 drizzle-kit 的交互式确认
 *
 * 用法：pnpm db:push
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 手动加载 .env（避免额外依赖 dotenv）
// 查找顺序：仓库根 .env → apps/api/.env，先找到的优先，已有的真实环境变量不被覆盖
function loadEnv() {
  const root = join(__dirname, '..', '..', '..')
  const candidates = [join(root, '.env'), join(__dirname, '..', '.env')]
  for (const file of candidates) {
    try {
      const content = readFileSync(file, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx === -1) continue
        const key = trimmed.slice(0, idx).trim()
        let value = trimmed.slice(idx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      /* 文件不存在时继续尝试下一个 */
    }
  }
}

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌ 未找到 DATABASE_URL。请先复制 .env.example 为 .env 并填写连接串。')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false })

const STATEMENTS = [
  /* 管理员 ------------------------------------------------------- */
  `create table if not exists admins (
     id serial primary key,
     username varchar(64) not null,
     password_hash text not null,
     display_name varchar(64) not null default '管理员',
     must_change_password boolean not null default false,
     last_login_at timestamptz,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists admins_username_idx on admins (username)`,

  /* 分类 --------------------------------------------------------- */
  `create table if not exists categories (
     id serial primary key,
     name varchar(100) not null,
     slug varchar(120) not null,
     description text,
     color varchar(16),
     sort_order integer not null default 0,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists categories_slug_idx on categories (slug)`,

  /* 文章 --------------------------------------------------------- */
  `create table if not exists articles (
     id serial primary key,
     title varchar(255) not null,
     slug varchar(255) not null,
     content text not null default '',
     excerpt text,
     cover_image text,
     category_id integer references categories(id) on delete set null,
     status varchar(16) not null default 'draft',
     featured boolean not null default false,
     views integer not null default 0,
     author varchar(100),
     published_at timestamptz,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists articles_slug_idx on articles (slug)`,
  `create index if not exists articles_status_idx on articles (status)`,
  `create index if not exists articles_category_idx on articles (category_id)`,
  `create index if not exists articles_published_idx on articles (published_at)`,

  /* 公告 --------------------------------------------------------- */
  `create table if not exists announcements (
     id serial primary key,
     title varchar(255) not null,
     content text not null default '',
     level varchar(16) not null default 'info',
     status varchar(16) not null default 'draft',
     pinned boolean not null default false,
     starts_at timestamptz,
     ends_at timestamptz,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists announcements_status_idx on announcements (status)`,
  `create index if not exists announcements_pinned_idx on announcements (pinned)`,

  /* 单页 --------------------------------------------------------- */
  `create table if not exists pages (
     id serial primary key,
     title varchar(255) not null,
     slug varchar(255) not null,
     summary text,
     content text not null default '',
     status varchar(16) not null default 'published',
     show_in_nav boolean not null default true,
     sort_order integer not null default 0,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists pages_slug_idx on pages (slug)`,

  /* 站点设置 ----------------------------------------------------- */
  `create table if not exists settings (
     key varchar(64) primary key,
     value jsonb not null,
     updated_at timestamptz not null default now()
   )`,

  /* 媒体 --------------------------------------------------------- */
  `create table if not exists media (
     id serial primary key,
     filename varchar(255) not null,
     url text not null,
     mime_type varchar(100) not null,
     bytes integer not null default 0,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists media_created_idx on media (created_at)`,

  /* 留言 --------------------------------------------------------- */
  `create table if not exists messages (
     id serial primary key,
     name varchar(100) not null,
     email varchar(200),
     phone varchar(50),
     subject varchar(255),
     content text not null,
     handled boolean not null default false,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists messages_handled_idx on messages (handled)`,

  /* 老库升级：以下语句在表已存在时补齐新增列（重复执行安全） ------- */
  `alter table pages add column if not exists summary text`,
  `alter table messages add column if not exists updated_at timestamptz not null default now()`,
]

async function main() {
  console.log('→ 正在同步数据库表结构…\n')

  const host = (() => {
    try {
      return new URL(url!).host
    } catch {
      return '(无法解析)'
    }
  })()
  console.log(`  目标数据库：${host}\n`)

  for (const statement of STATEMENTS) {
    const label = /create table if not exists (\w+)/.exec(statement)?.[1]
    try {
      await sql.unsafe(statement)
      if (label) console.log(`  ✓ 表 ${label}`)
    } catch (error) {
      console.error(`  ✗ 执行失败：${statement.slice(0, 80)}…`)
      throw error
    }
  }

  console.log('\n✅ 数据库结构同步完成。\n')
  console.log('   下一步：pnpm db:seed  写入示例内容与默认主题\n')
}

main()
  .catch((error) => {
    console.error('\n❌ 建表失败：', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => sql.end())
