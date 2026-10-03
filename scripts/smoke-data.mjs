/**
 * 冒烟测试：检查示例数据与管理员账号是否已写入。
 * 用法：node scripts/smoke-data.mjs
 */

import { readFileSync } from 'node:fs'

function readEnvValue(key) {
  let content = ''
  try {
    content = readFileSync('.env', 'utf8')
  } catch {
    return ''
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    if (trimmed.slice(0, idx).trim() !== key) continue
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  return ''
}

const url = readEnvValue('DATABASE_URL')
const { neon } = await import('@neondatabase/serverless')
const sql = neon(url)

const counts = await sql`
  select
    (select count(*) from admins)        as admins,
    (select count(*) from categories)    as categories,
    (select count(*) from articles)      as articles,
    (select count(*) from announcements) as announcements,
    (select count(*) from pages)         as pages,
    (select count(*) from settings)      as settings
`
console.log('数据统计:', JSON.stringify(counts[0], null, 0))

const admins = await sql`select id, username, display_name, must_change_password from admins`
console.log('管理员账号:', JSON.stringify(admins))

const articles = await sql`select title, slug, status, featured from articles order by id limit 5`
console.log('前 5 篇文章:')
for (const a of articles) {
  console.log(`  - [${a.status}]${a.featured ? ' ★' : '  '} ${a.title}  (${a.slug})`)
}

const settings = await sql`select key from settings`
console.log('settings 键:', settings.map((s) => s.key).join(', ') || '(空)')
