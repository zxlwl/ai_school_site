/**
 * 论坛功能端到端冒烟测试（直连真库 + 测构建产物）。
 *
 * 覆盖：版块列表 → 发主题 → 主题列表 → 主题详情 → 回复 → 计数 →
 *       权限（未登录不能发、禁言不能发）→ 管理端（建版块、置顶、锁定、隐藏）。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import postgres from 'postgres'

const root = resolve(process.cwd())
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  /* ignore */
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
const { app } = await import(
  pathToFileURL(join(root, '.vercel/output/functions/index.func/app.js')).href
)

let pass = 0
let fail = 0
function check(label, okk, extra = '') {
  if (okk) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label} ${extra}`)
  }
}

function newClient() {
  let cookie = ''
  return async (method, path, body) => {
    const headers = { 'content-type': 'application/json' }
    if (cookie) headers.cookie = cookie
    const res = await app.fetch(
      new Request(`http://local${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(';')[0]
      for (const name of ['school_session=', 'school_user=']) {
        if (pair.includes(name)) {
          if (pair.endsWith(name)) {
            if (name === 'school_session=') cookie = cookie.split(';').filter((p) => !p.includes(name)).join(';')
            else cookie = cookie.split(';').filter((p) => !p.includes(name)).join(';')
          } else {
            const others = cookie.split(';').filter((p) => p.trim() && !p.includes(name))
            cookie = [...others, pair].join('; ')
          }
        }
      }
    }
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text.slice(0, 120)
    }
    return { status: res.status, data }
  }
}

const tag = Date.now().toString(36).slice(-6)
const boardSlug = `zz-test-board-${tag}`

/* 准备：临时管理员 + 临时会员 */
const bcrypt = (await import(pathToFileURL(join(root, 'node_modules/bcryptjs/index.js')).href)).default
const adminHash = await bcrypt.hash('admin-pass-1234', 10)
const userHash = await bcrypt.hash('user-pass-1234', 10)

await sql`
  insert into admins (username, password_hash, display_name, role, active, must_change_password)
  values (${'zz_fadmin_' + tag}, ${adminHash}, '论坛测试管理', 'editor', true, false)
`
const memberName = `zz_fuser_${tag}`
const [member] = await sql`
  insert into users (username, email, password_hash, display_name, role, status)
  values (${memberName}, ${memberName + '@example.com'}, ${userHash}, '论坛测试会员', 'member', 'active')
  returning id
`

console.log('\n=== 1. 管理员建版块 ===')
const admin = newClient()
let r = await admin('POST', '/api/auth/login', { username: `zz_fadmin_${tag}`, password: 'admin-pass-1234' })
check('管理员登录', r.status === 200, `实际 ${r.status}`)

r = await admin('POST', '/api/admin/forum/boards', {
  name: `测试版块${tag}`,
  slug: boardSlug,
  description: '冒烟测试用',
  postPolicy: 'member_only',
})
check('创建版块 201', r.status === 201, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`)
const boardId = r.data?.data?.board?.id

console.log('\n=== 2. 版块列表（公开） ===')
r = await admin('GET', '/api/forum/boards')
check('版块列表 200', r.status === 200, `实际 ${r.status}`)
check('包含新创建的版块', JSON.stringify(r.data).includes(boardSlug))

console.log('\n=== 3. 未登录不能发主题 ===')
const guest = newClient()
r = await guest('POST', '/api/forum/topics', { boardId, title: '未登录发帖', content: '应该失败' })
check('未登录发主题 401', r.status === 401, `实际 ${r.status}`)

console.log('\n=== 4. 会员发主题 ===')
const user = newClient()
r = await user('POST', '/api/account/login', { account: memberName, password: 'user-pass-1234' })
check('会员登录', r.status === 200, `实际 ${r.status}`)

r = await user('POST', '/api/forum/topics', {
  boardId,
  title: `测试主题 ${tag}`,
  content: '这是冒烟测试的正文内容，需要至少两个字。',
})
check('发主题 201', r.status === 201, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`)
const topicSlug = r.data?.data?.topic?.slug
const topicId = r.data?.data?.topic?.id
check('主题 slug 已生成', Boolean(topicSlug), `slug=${topicSlug}`)
check('默认状态 published', r.data?.data?.topic?.status === 'published')

console.log('\n=== 5. 标题过短应被拒 ===')
r = await user('POST', '/api/forum/topics', { boardId, title: 'x', content: '正文内容足够长' })
check('短标题 400', r.status === 400, `实际 ${r.status}`)

console.log('\n=== 6. 主题列表 ===')
r = await guest('GET', `/api/forum/boards/${boardSlug}/topics`)
check('主题列表 200', r.status === 200, `实际 ${r.status}`)
check('列表包含刚发的主题', JSON.stringify(r.data).includes(topicSlug))
check('返回分页信息', r.data?.data?.pagination?.total >= 1, JSON.stringify(r.data?.data?.pagination))

console.log('\n=== 7. 主题详情 ===')
r = await guest('GET', `/api/forum/topics/${topicSlug}`)
check('详情 200', r.status === 200, `实际 ${r.status}`)
check('含正文', String(r.data?.data?.topic?.content ?? '').includes('冒烟测试'))
check('作者信息完整', Boolean(r.data?.data?.topic?.author?.displayName))

console.log('\n=== 8. 回复 ===')
const beforeCount = r.data?.data?.topic?.replyCount ?? 0
r = await user('POST', `/api/forum/topics/${topicId}/replies`, { content: '第一条回复内容' })
check('回复 201', r.status === 201, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`)
const firstReplyId = r.data?.data?.post?.id

r = await user('POST', `/api/forum/topics/${topicId}/replies`, {
  content: '这是楼中楼回复',
  replyTo: firstReplyId,
})
check('楼中楼回复 201', r.status === 201, `实际 ${r.status}`)
check('replyTo 已记录', r.data?.data?.post?.replyTo === firstReplyId)
check('带出被回复者名字', r.data?.data?.post?.replyToAuthor === '论坛测试会员', String(r.data?.data?.post?.replyToAuthor))

console.log('\n=== 9. 回复计数已更新 ===')
r = await guest('GET', `/api/forum/topics/${topicSlug}`)
check('replyCount = 2', r.data?.data?.topic?.replyCount === 2, `实际 ${r.data?.data?.topic?.replyCount}`)
check('回复列表 2 条', (r.data?.data?.posts ?? []).length === 2, `实际 ${(r.data?.data?.posts ?? []).length}`)

console.log('\n=== 10. 频率限制 ===')
let hitLimit = false
for (let i = 0; i < 6; i++) {
  const resp = await user('POST', `/api/forum/topics/${topicId}/replies`, { content: `刷屏测试 ${i}` })
  if (resp.status === 429) {
    hitLimit = true
    break
  }
}
check('触发 429 频率限制', hitLimit, '连续发 6 帖仍未限流')

console.log('\n=== 11. 管理端：置顶 + 锁定 ===')
r = await admin('PATCH', `/api/admin/forum/topics/${topicId}`, { pinned: true, locked: true })
check('置顶锁定 200', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`)

r = await user('POST', `/api/forum/topics/${topicId}/replies`, { content: '锁定后不该能回复' })
check('锁定后回复被拒 403', r.status === 403, `实际 ${r.status}`)

console.log('\n=== 12. 置顶帖排在最前 ===')
r = await guest('GET', `/api/forum/boards/${boardSlug}/topics`)
const firstTopicId = r.data?.data?.topics?.[0]?.id
check('置顶帖在列表首位', firstTopicId === topicId, `首位 id=${firstTopicId}，期望 ${topicId}`)

console.log('\n=== 13. 禁言后不能发帖 ===')
await sql`update users set status = 'muted' where id = ${member.id}`
r = await user('POST', `/api/forum/topics/${topicId}/replies`, { content: '禁言后不该能发' })
check('禁言后回复被拒 403', r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
r = await user('POST', '/api/forum/topics', { boardId, title: '禁言发主题', content: '应该被拒绝' })
check('禁言后发主题被拒 403', r.status === 403, `实际 ${r.status}`)
await sql`update users set status = 'active' where id = ${member.id}`

console.log('\n=== 14. 别人不能编辑我的主题 ===')
const otherName = `zz_fother_${tag}`
await sql`
  insert into users (username, password_hash, display_name, role, status)
  values (${otherName}, ${userHash}, '另一个会员', 'member', 'active')
`
const other = newClient()
await other('POST', '/api/account/login', { account: otherName, password: 'user-pass-1234' })
r = await other('PATCH', `/api/forum/topics/${topicId}`, { title: '我要改别人的帖子' })
check('编辑他人主题 403', r.status === 403, `实际 ${r.status}`)

console.log('\n=== 15. 有主题的版块不能删 ===')
r = await admin('DELETE', `/api/admin/forum/boards/${boardId}`)
check('删除非空版块 409', r.status === 409, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)

console.log('\n=== 16. 隐藏主题后前台不可见 ===')
r = await admin('PATCH', `/api/admin/forum/topics/${topicId}`, { status: 'hidden' })
check('隐藏主题 200', r.status === 200, `实际 ${r.status}`)
r = await guest('GET', `/api/forum/topics/${topicSlug}`)
check('隐藏后详情 404', r.status === 404, `实际 ${r.status}`)

/* ------------------------------ 清理 ------------------------------ */
console.log('\n=== 清理 ===')
await sql`delete from forum_topics where board_id = ${boardId}`
await sql`delete from forum_boards where id = ${boardId}`
await sql`delete from users where username like ${'zz_fuser_%'} or username like ${'zz_fother_%'}`
await sql`delete from admins where username like ${'zz_fadmin_%'}`

const leftTopics = await sql`select count(*)::int as n from forum_topics where board_id = ${boardId}`
check('测试主题已清理', leftTopics[0].n === 0)

console.log(`\n${fail === 0 ? '✓' : '✗'} 通过 ${pass}，失败 ${fail}`)
await sql.end()
if (fail > 0) process.exit(1)
