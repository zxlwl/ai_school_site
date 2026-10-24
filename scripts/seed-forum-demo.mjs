/**
 * 给论坛灌入演示主题与回复（幂等：按 title 判重，已存在则跳过）。
 * 直接写数据库，不走 API，避免受登录态与频率限制影响。
 *
 * 注意表结构（apps/api/src/db/schema.ts）：
 *   forum_topics: board_id, author_id, title, slug(NOT NULL), content(首楼正文),
 *                 status, pinned, locked, views, reply_count, last_reply_at
 *   forum_posts : topic_id, author_id, content, status, reply_to（没有 floor 列）
 *   forum_boards: 没有 topic_count / post_count 冗余列，计数实时算
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const env = {}
try {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* 没有 .env 就用进程环境 */
}

const url = process.env.DATABASE_URL || env.DATABASE_URL
if (!url) {
  console.error('✗ 缺少 DATABASE_URL')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false })

/** 由标题生成 slug；中文标题保留可读的拼音式占位，靠 id 兜底唯一性。 */
function slugify(title) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'topic'
}

const TOPICS = [
  {
    board: 'campus-life',
    title: '食堂二楼新开的面档有人试过吗',
    body: '中午路过看到排了很长的队，不知道味道怎么样。有同学去吃过吗？价格看着还挺实惠的。',
    replies: [
      '昨天去了，牛肉面分量很足，汤头也不错，就是等的时间有点久。',
      '推荐他们家的酸辣粉，比一楼的够味。',
    ],
  },
  {
    board: 'campus-life',
    title: '图书馆自习室周末开放时间能不能延长',
    body: '现在周末下午五点就闭馆了，感觉对要准备考试的同学不太友好。',
    replies: ['同意，希望至少能到晚上九点。'],
  },
  {
    board: 'study',
    title: '高二物理选修三的复习资料整理（持续更新）',
    body: '把这一章的公式和典型例题按知识点整理了一下，需要的同学可以自取。\n\n如果有错误欢迎在楼下指出。',
    replies: [
      '感谢分享！第三章的例题能不能也补充一下？',
      '已经下载了，排版很清晰，谢谢。',
    ],
  },
  {
    board: 'study',
    title: '英语听力总是跟不上，有什么练习方法吗',
    body: '每次听力考试前半段还行，后面就完全跟不上了。想问问大家平时怎么练的。',
    replies: [
      '建议每天固定听 15 分钟，材料比考试稍难一点，坚持一个月会有明显变化。',
      '可以先做精听，一句一句写下来，再对照原文。',
    ],
  },
  {
    board: 'clubs',
    title: '摄影社秋季招新，欢迎报名',
    body: '摄影社本学期计划组织两次外拍活动，零基础也可以参加，社里有设备可以借用。\n\n报名请到社团活动室登记。',
    replies: ['零基础真的可以吗？我一直想学但怕跟不上。'],
  },
  {
    board: 'feedback',
    title: '建议在教学楼增加直饮水机',
    body: '现在整栋楼只有一楼有一台，课间排队的人很多，楼层高的同学基本来不及接水。',
    replies: ['支持，三楼以上确实很不方便。'],
  },
]

async function main() {
  console.log('→ 正在写入论坛演示数据…\n')

  // 1. 找一个可用的会员账号；没有就创建一个
  let author = (await sql`select id, username from users where status = 'active' order by id limit 1`)[0]
  if (!author) {
    const { default: bcrypt } = await import('bcryptjs')
    const hash = await bcrypt.hash('demo12345', 10)
    const created = await sql`
      insert into users (username, email, password_hash, display_name, role, status)
      values ('demo_student', 'demo_student@example.edu.cn', ${hash}, '热心同学', 'member', 'active')
      returning id, username
    `
    author = created[0]
    console.log(`  ✓ 创建演示账号 ${author.username} / demo12345`)
  } else {
    console.log(`  · 使用现有会员账号 ${author.username}`)
  }

  let topicCount = 0
  let postCount = 0

  for (const t of TOPICS) {
    const board = (await sql`select id from forum_boards where slug = ${t.board} limit 1`)[0]
    if (!board) {
      console.log(`  · 版块 ${t.board} 不存在，跳过`)
      continue
    }

    const existing = await sql`select id from forum_topics where title = ${t.title} limit 1`
    if (existing.length > 0) continue

    // slug 要全局唯一，撞了就拼上时间戳后缀
    let slug = slugify(t.title)
    const clash = await sql`select 1 from forum_topics where slug = ${slug} limit 1`
    if (clash.length > 0) slug = `${slug}-${Date.now().toString(36)}`

    const now = new Date()
    const topic = (
      await sql`
        insert into forum_topics (board_id, author_id, title, slug, content, status,
                                  pinned, locked, views, reply_count, last_reply_at)
        values (${board.id}, ${author.id}, ${t.title}, ${slug}, ${t.body}, 'published',
                false, false, ${Math.floor(Math.random() * 120) + 15},
                ${t.replies.length}, ${now})
        returning id
      `
    )[0]
    topicCount++

    for (const r of t.replies) {
      await sql`
        insert into forum_posts (topic_id, author_id, content, status)
        values (${topic.id}, ${author.id}, ${r}, 'published')
      `
      postCount++
    }
  }

  console.log(`  ✓ 主题 ${topicCount} 个`)
  console.log(`  ✓ 回复 ${postCount} 层`)

  const summary = await sql`
    select b.name,
           (select count(*) from forum_topics t where t.board_id = b.id and t.status = 'published') as topics,
           (select count(*) from forum_posts p
              join forum_topics t2 on t2.id = p.topic_id
             where t2.board_id = b.id and p.status = 'published') as posts
    from forum_boards b order by b.sort_order
  `
  console.log('\n当前版块概况：')
  for (const b of summary) {
    console.log(`  - ${b.name}：主题 ${b.topics}，回复 ${b.posts}`)
  }

  await sql.end()
  console.log('\n✅ 完成。\n')
}

main().catch(async (e) => {
  console.error('✗', e.message)
  await sql.end()
  process.exit(1)
})
