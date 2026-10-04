/**
 * 用纯 Node 实际加载 Build Output API 产物里的函数，并探测各条路由。
 *
 * 刻意不用 tsx：tsx 会即时编译 TS，掩盖「运行时拿到裸 .ts」这类问题。
 * 这里加载的是 Vercel 真正会执行的那个 index.mjs。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.cwd())
const funcDir = resolve(root, '.vercel/output/functions/index.func')
const entry = resolve(funcDir, 'index.mjs')

if (!existsSync(entry)) {
  console.error(`x 找不到函数入口: ${entry}`)
  process.exit(1)
}

// 在最外层注入环境变量（Vercel 运行时也是服务进程级注入）
const envFile = resolve(root, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  console.log('[env] 已从 .env 注入 DATABASE_URL / AUTH_SECRET 等')
}

const mod = await import(pathToFileURL(entry).href)
const handler = mod.default
if (typeof handler !== 'function') {
  console.error('x 函数入口没有 default 导出，或不是可调用的 fetch handler')
  process.exit(1)
}
console.log(`[ok] 纯 Node 成功加载函数入口 (Node ${process.version})`)

const routes = [
  ['GET', '/api/health'],
  ['GET', '/api/public/home'],
  ['GET', '/api/public/navigation'],
  ['GET', '/api/auth/session'],
  ['GET', '/api/admin/stats'],
]

let failed = 0
for (const [method, path] of routes) {
  let line
  try {
    const res = await handler(new Request(`https://example.com${path}`, { method }))
    const body = await res.text()
    const short = body.length > 110 ? `${body.slice(0, 110)}…` : body

    const expected =
      path === '/api/health' ? res.status === 200
      : path === '/api/admin/stats' ? res.status === 401
      : res.status === 200
    if (!expected) failed++

    line = `${expected ? '  OK ' : '  !! '} ${String(res.status).padEnd(4)} ${path}`
    console.log(`${line}\n       ${short}`)
  } catch (err) {
    failed++
    console.log(`  !!   ERR  ${path}\n       ${err && err.message}`)
  }
}

console.log('')
if (failed) {
  console.log(`x ${failed} 条路由不符合预期`)
  process.exit(1)
}
console.log('✓ 全部路由符合预期')
