/**
 * 管理员账号权限模型冒烟测试（直连真库）。
 *
 * 覆盖 m03228 要求的「完善账号系统」里最危险的部分：
 *   - owner 能管理账号
 *   - 新建的 editor 能写内容，但不能管理账号
 *   - 新建的 viewer 连内容都不能写
 *   - 三条防自锁规则：不能停用自己、不能降级自己、不能删掉最后一个 owner
 *
 * 为了不依赖线上管理员密码，测试开始时临时插入一个已知密码的 owner，
 * 结束后删除。所有测试账号都以 zz_test_ 开头，便于清理。
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
function check(label, ok, extra = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label} ${extra}`)
  }
}

/** 每个「浏览器」独立持有一份 cookie。 */
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
      if (pair.includes('school_session=')) {
        cookie = pair.endsWith('school_session=') ? '' : pair
      }
    }
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text.slice(0, 100)
    }
    return { status: res.status, data }
  }
}

const tag = Date.now().toString(36).slice(-6)
const ownerName = `zz_test_owner_${tag}`
const OWNER_PW = 'owner-pass-1234'

// 临时 owner：把 owner1234 的 bcrypt hash 直接写库
const { default: bcrypt } = await import(
  pathToFileURL(join(root, 'node_modules/bcryptjs/index.js')).href
)
const hash = await bcrypt.hash(OWNER_PW, 10)

console.log('\n=== 准备：插入临时 owner ===')
await sql`
  insert into admins (username, password_hash, display_name, role, active, must_change_password)
  values (${ownerName}, ${hash}, '测试超管', 'owner', true, false)
`
check('临时 owner 已创建', true)

const owner = newClient()
let r = await owner('POST', '/api/auth/login', { username: ownerName, password: OWNER_PW })
check('临时 owner 登录成功', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`)
check('登录返回 role=owner', r.data?.data?.role === 'owner', JSON.stringify(r.data).slice(0, 160))

console.log('\n=== 1. owner 查看账号列表 ===')
r = await owner('GET', '/api/admin/accounts')
check('列表 200', r.status === 200, `实际 ${r.status}`)
check('列表是数组', Array.isArray(r.data?.data?.accounts ?? r.data?.data), JSON.stringify(r.data).slice(0, 120))
check('列表不含 passwordHash', !JSON.stringify(r.data).includes('passwordHash'))

console.log('\n=== 2. owner 创建 editor / viewer ===')
const editorName = `zz_test_editor_${tag}`
const viewerName = `zz_test_viewer_${tag}`
r = await owner('POST', '/api/admin/accounts', {
  username: editorName,
  password: 'editor-pass-1234',
  displayName: '测试编辑',
  role: 'editor',
})
check('创建 editor 成功', r.status === 201 || r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
const editorId = r.data?.data?.admin?.id ?? r.data?.data?.id

r = await owner('POST', '/api/admin/accounts', {
  username: viewerName,
  password: 'viewer-pass-1234',
  displayName: '测试只读',
  role: 'viewer',
})
check('创建 viewer 成功', r.status === 201 || r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
const viewerId = r.data?.data?.admin?.id ?? r.data?.data?.id

console.log('\n=== 3. editor 能写内容 ===')
const editor = newClient()
r = await editor('POST', '/api/auth/login', { username: editorName, password: 'editor-pass-1234' })
check('editor 登录成功', r.status === 200, `实际 ${r.status}`)
r = await editor('GET', '/api/admin/articles')
check('editor 可读文章列表', r.status === 200, `实际 ${r.status}`)
r = await editor('POST', '/api/admin/categories', { name: `测试分类${tag}`, slug: `test-cat-${tag}` })
check('editor 可创建分类（写）', r.status === 201 || r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
const createdCatId = r.data?.data?.category?.id ?? r.data?.data?.id

console.log('\n=== 4. editor 不能管理账号 ===')
r = await editor('GET', '/api/admin/accounts')
check('editor 访问账号列表被拒 403', r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`)

console.log('\n=== 5. viewer 只读 ===')
const viewer = newClient()
r = await viewer('POST', '/api/auth/login', { username: viewerName, password: 'viewer-pass-1234' })
check('viewer 登录成功', r.status === 200, `实际 ${r.status}`)
r = await viewer('GET', '/api/admin/articles')
check('viewer 可读文章列表', r.status === 200, `实际 ${r.status}`)
r = await viewer('POST', '/api/admin/categories', { name: `viewer试图创建${tag}`, slug: `viewer-cat-${tag}` })
check('viewer 创建分类被拒 403', r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`)
r = await viewer('GET', '/api/admin/accounts')
check('viewer 访问账号列表被拒 403', r.status === 403, `实际 ${r.status}`)

console.log('\n=== 6. 防自锁：不能停用自己 ===')
const meId = (await owner('GET', '/api/auth/session')).data?.data?.id
r = await owner('PUT', `/api/admin/accounts/${meId}`, { active: false })
check('停用自己被拒', r.status === 400 || r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)

console.log('\n=== 7. 防自锁：不能降级自己 ===')
r = await owner('PUT', `/api/admin/accounts/${meId}`, { role: 'viewer' })
check('降级自己被拒', r.status === 400 || r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)

console.log('\n=== 8. 防自锁：不能删最后一个 owner ===')
r = await owner('DELETE', `/api/admin/accounts/${meId}`)
check('删除自己被拒', r.status === 400 || r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)

console.log('\n=== 9. 停用账号后无法登录 ===')
if (viewerId) {
  r = await owner('PUT', `/api/admin/accounts/${viewerId}`, { active: false })
  check('停用 viewer 成功', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
  const v2 = newClient()
  r = await v2('POST', '/api/auth/login', { username: viewerName, password: 'viewer-pass-1234' })
  check('已停用账号登录被拒 403', r.status === 403, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
}

console.log('\n=== 10. 强制改密标记 ===')
if (editorId) {
  r = await owner('POST', `/api/admin/accounts/${editorId}/force-password-change`)
  check('强制改密 200', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 140)}`)
  const e2 = newClient()
  r = await e2('POST', '/api/auth/login', { username: editorName, password: 'editor-pass-1234' })
  check('登录后 mustChangePassword=true', r.data?.data?.mustChangePassword === true, JSON.stringify(r.data).slice(0, 160))
}

/* ------------------------------ 清理 ------------------------------ */
console.log('\n=== 清理测试数据 ===')
if (createdCatId) await sql`delete from categories where id = ${createdCatId}`
await sql`delete from admins where username like ${'zz_test_%'}`
const left = await sql`select count(*)::int as n from admins where username like ${'zz_test_%'}`
check('测试账号已全部删除', left[0].n === 0, `残留 ${left[0].n}`)

console.log(`\n${fail === 0 ? '✓' : '✗'} 通过 ${pass}，失败 ${fail}`)
await sql.end()
if (fail > 0) process.exit(1)
