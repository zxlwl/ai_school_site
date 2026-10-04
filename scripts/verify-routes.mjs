/**
 * 本地模拟 Vercel routes 重写语义，验证 /api 前缀完整交给函数。
 *
 * ── dest 的语义（关键，曾经搞错）────────────────────────────────
 * Build Output API 的函数名 = 目录名去掉 .func（functions/index.func → "index"）。
 * dest 的第一段就是**函数名**，后面的部分原样转给函数：
 *     dest: '/index'        → 函数 index 收到原始路径 /api/health   ✓
 *     dest: '/api/index'    → 被当成名为 "api" 的函数 → 404          ✗
 * 不带捕获组时 Vercel 不会剥前缀，路径原样透传。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cfg = JSON.parse(
  readFileSync(resolve(process.cwd(), '.vercel/output/config.json'), 'utf8'),
)

console.log('路由规则:')
for (const r of cfg.routes) console.log('  ' + JSON.stringify(r))
console.log('')

/** 函数名 = functions/<name>.func 的 <name>。 */
function functionName(r) {
  const dest = String(r.dest ?? '')
  if (!dest || dest.includes('.html')) return null
  return dest.split('/').filter(Boolean)[0] ?? null
}

/** 返回函数实际收到的路径；不匹配返回 null。 */
function applyRoute(route, path) {
  if (!route.src) return null // handle: filesystem 交给静态资源
  const re = new RegExp('^' + route.src.replace(/\(\.\*\)/g, '(.*)').replace(/\//g, '\\/') + '$')
  const m = path.match(re)
  if (!m) return null
  let dest = String(route.dest).replace(/\$(\d+)/g, (_, i) => m[Number(i)] ?? '')
  const name = functionName(route)
  if (!name) return dest // 静态重写
  const rest = dest.slice(name.length + 1)
  // 不带捕获组时路径原样透传（Vercel 不剥前缀）
  if (!/\$\d/.test(String(route.dest)) && rest === '') return path
  return rest === '' ? '/' : rest
}

const cases = [
  // [请求路径, 期望函数收到的路径]
  ['/api/health', '/api/health'],
  ['/api/public/home', '/api/public/home'],
  ['/api/admin/stats', '/api/admin/stats'],
  ['/api/auth/session', '/api/auth/session'],
]

let fail = 0
for (const [reqPath, expected] of cases) {
  let mapped = null
  for (const r of cfg.routes) {
    const out = applyRoute(r, reqPath)
    if (out !== null) {
      mapped = out
      break
    }
  }
  const okk = mapped === expected
  if (!okk) fail++
  console.log(
    `  ${okk ? '✓' : '✗'} ${reqPath.padEnd(22)} → 函数收到 ${JSON.stringify(mapped)}` +
      (okk ? '' : `  期望 ${JSON.stringify(expected)}`),
  )
}

console.log('')
console.log('前端路径应落到 SPA 兜底（不经过函数）:')
for (const p of ['/', '/admin', '/admin/articles', '/news/hello']) {
  let mapped = null
  let hitApi = false
  for (const r of cfg.routes) {
    if (!r.src) continue
    const out = applyRoute(r, p)
    if (out !== null) {
      mapped = out
      hitApi = String(r.src).includes('/api/')
      break
    }
  }
  const okk = mapped === '/index.html' && !hitApi
  if (!okk) fail++
  console.log(`  ${okk ? '✓' : '✗'} ${p.padEnd(22)} → ${JSON.stringify(mapped)}`)
}

console.log('')
if (fail) {
  console.log(`✗ ${fail} 条不符合预期`)
  process.exit(1)
}
console.log('✓ 路由语义符合预期（/api 前缀完整保留，前端走 SPA 兜底）')
