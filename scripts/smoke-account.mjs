/**
 * 会员账号系统端到端冒烟测试（直连真库）。
 *
 * 测试的是**构建产物**（.vercel/output/functions/index.func/index.mjs），
 * 而不是 apps/api/dist —— 后者里的相对导入还没补 .js 后缀，Node 解析不了；
 * 补后缀是 build-api.mjs 在搬运时做的。直接测产物还有个好处：
 * 这就是 Vercel 上跑的同一份代码。
 *
 * 覆盖：注册 → 会话 → 改资料 → 改密码 → 退出 → 用新密码登录，
 * 以及一组必须被拒绝的反例。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.cwd())

// 注入 .env
const envPath = join(root, '.env')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  /* 没有 .env 就靠已有的环境变量 */
}

/*
 * 直接导入 app.js（不是 index.mjs）：
 * index.mjs 的 default export 是 handle(app)，那是 Vercel 的适配层；
 * 这里要的是 Hono 实例本身，好直接调它的 .fetch。
 */
const appEntry = join(root, '.vercel/output/functions/index.func/app.js')
const { app } = await import(pathToFileURL(appEntry).href)


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

/** 发请求；把响应的 set-cookie 收集起来模拟浏览器。 */
let cookie = ''
async function call(method, path, body) {
  const headers = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  const res = await app.fetch(
    new Request(`http://local${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    const pair = c.split(';')[0]
    if (pair.includes('school_user=')) {
      cookie = pair.endsWith('school_user=') ? '' : pair
    }
  }
  let data = null
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch {
    data = text.slice(0, 120)
  }
  return { status: res.status, data }
}

const suffix = Date.now().toString(36).slice(-6)
const username = `smoke_${suffix}`
const password = 'test-pass-1234'

console.log('\n=== 1. 注册 ===')
let r = await call('POST', '/api/account/register', {
  username,
  password,
  email: `${username}@example.com`,
  displayName: '冒烟测试',
})
check('注册成功返回 201', r.status === 201, `实际 ${r.status} ${JSON.stringify(r.data)}`)
check('返回用户资料', r.data?.data?.user?.username === username, JSON.stringify(r.data).slice(0, 160))
check('绝不返回 passwordHash', !JSON.stringify(r.data).includes('passwordHash'))
check('注册后已下发会话 Cookie', cookie.includes('school_user='))

console.log('\n=== 2. 会话 ===')
r = await call('GET', '/api/account/session')
check('session 返回 authenticated=true', r.data?.data?.authenticated === true, JSON.stringify(r.data).slice(0, 160))

console.log('\n=== 3. 重名注册应被拒绝 ===')
r = await call('POST', '/api/account/register', { username, password })
check('重名返回 409', r.status === 409, `实际 ${r.status}`)

console.log('\n=== 4. 弱密码应被拒绝 ===')
r = await call('POST', '/api/account/register', { username: `weak_${suffix}`, password: '123' })
check('短密码返回 400', r.status === 400, `实际 ${r.status}`)

console.log('\n=== 5. 修改资料 ===')
r = await call('PUT', '/api/account/profile', { displayName: '改名成功', email: `${username}@example.com` })
check('修改资料 200', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`)
check('显示名已更新', r.data?.data?.user?.displayName === '改名成功')

console.log('\n=== 6. 改密码 ===')
r = await call('POST', '/api/account/change-password', { currentPassword: password, newPassword: 'new-pass-5678' })
check('改密码 200', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`)

console.log('\n=== 7. 退出 ===')
r = await call('POST', '/api/account/logout')
check('退出 200', r.status === 200)
check('退出后会话已清', !cookie.includes('school_user='))

console.log('\n=== 8. 旧密码应登录失败 ===')
r = await call('POST', '/api/account/login', { account: username, password })
check('旧密码 401', r.status === 401, `实际 ${r.status}`)

console.log('\n=== 9. 新密码登录 ===')
r = await call('POST', '/api/account/login', { account: username, password: 'new-pass-5678' })
check('新密码登录 200', r.status === 200, `实际 ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`)

console.log('\n=== 10. 用邮箱也能登录 ===')
r = await call('POST', '/api/account/login', { account: `${username}@example.com`, password: 'new-pass-5678' })
check('邮箱登录 200', r.status === 200, `实际 ${r.status}`)

console.log('\n=== 11. 会员令牌不能碰后台 ===')
r = await call('GET', '/api/admin/stats')
check('会员访问 admin 返回 401', r.status === 401, `实际 ${r.status}`)

console.log('\n=== 12. 未登录访问账号接口 ===')
cookie = ''
r = await call('GET', '/api/account/session')
check('未登录 session authenticated=false', r.data?.data?.authenticated === false, JSON.stringify(r.data).slice(0, 120))

console.log(`\n${fail === 0 ? '✓' : '✗'} 通过 ${pass}，失败 ${fail}`)
if (fail > 0) process.exit(1)
