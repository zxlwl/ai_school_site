/* 清理测试残留：e2e_* 账号及其主题。 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const env = {}
for (const line of readFileSync(resolve('D:/agent/school-site/.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false })

const pat = 'e2e_%'
const patSmoke = 'smoke_%'
const patZz = 'zz_%'

// 先删这些人的主题/回复（外键 cascade 也能处理，但显式更清楚）
const topics = await sql`
  delete from forum_topics
  where author_id in (
    select id from users
    where username like ${pat} or username like ${patSmoke} or username like ${patZz}
  )
  returning id
`
const posts = await sql`
  delete from forum_posts
  where author_id in (
    select id from users
    where username like ${pat} or username like ${patSmoke} or username like ${patZz}
  )
  returning id
`
const users = await sql`
  delete from users
  where username like ${pat} or username like ${patSmoke} or username like ${patZz}
  returning username
`

console.log(`清理：主题 ${topics.length}、回复 ${posts.length}、账号 ${users.length}`)
console.log(`  账号：${users.map((u) => u.username).join(', ') || '（无）'}`)

console.log('\n=== 最终论坛状态 ===')
for (const b of await sql`
  select b.name,
         (select count(*) from forum_topics t where t.board_id=b.id and t.status='published') as topics
  from forum_boards b order by b.sort_order
`) {
  console.log(`  ${b.name}：主题 ${b.topics}`)
}

const total = await sql`select count(*)::int as n from users`
console.log(`\n会员总数：${total[0].n}`)
for (const u of await sql`select username, display_name, role, status from users order by id`) {
  console.log(`  - ${u.username} (${u.display_name ?? '-'}) ${u.role}/${u.status}`)
}

await sql.end()
