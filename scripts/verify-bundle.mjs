/**
 * 最终验收：在完全干净的环境中验证 Vercel 函数产物。
 *
 * 关键点：必须用「纯 Node」加载 —— 绝不能用 tsx。
 * tsx 会即时编译 TS，从而掩盖"运行时拿到裸 .ts 引用"这类问题；
 * 我们此前正是因此误判过一次。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sim = process.argv[2] ?? resolve(process.cwd())
const bundle = resolve(sim, 'api/index.mjs')

console.log(`模拟目录: ${sim}`)
console.log(`产物路径: ${bundle}`)

if (!existsSync(bundle)) {
  console.error('✗ 产物不存在')
  process.exit(1)
}

// 校验产物编码
const code = readFileSync(bundle, 'utf8')
const fffd = [...code.matchAll(/\uFFFD/g)].length
console.log(`编码检查: U+FFFD = ${fffd}  ${fffd === 0 ? '✓' : '✗'}`)

// 注入 .env（模拟 Vercel 的环境变量）
const envPath = resolve(sim, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  console.log('环境变量: 已从 .env 注入')
}

// 纯 Node 动态导入（非 tsx）。
// Windows 上绝对路径必须先转成 file:// URL，否则报 ERR_UNSUPPORTED_ESM_URL_SCHEME。
const mod = await import(pathToFileURL(bundle).href)
console.log(`导出类型: ${typeof mod.default}  ${typeof mod.default === 'function' ? '✓' : '✗'}`)
console.log(`config.runtime: ${mod.config?.runtime}`)

if (typeof mod.default !== 'function') {
  console.error('✗ 默认导出不是函数')
  process.exit(1)
}

console.log('\n路由实测:')
const probes = [
  ['/api/health', 200],
  ['/api/public/home', 200],
  ['/api/public/navigation', 200],
  ['/api/public/articles', 200],
  ['/api/auth/session', 200],
  ['/api/admin/stats', 401],
]

let failed = 0
for (const [path, expect] of probes) {
  try {
    const res = await mod.default(new Request(`https://school.example.com${path}`))
    const body = await res.text()
    const ok = res.status === expect
    if (!ok) failed++
    console.log(`  ${ok ? '✓' : '✗'} ${path.padEnd(26)} ${res.status} (期望 ${expect})  ${body.slice(0, 52).replace(/\s+/g, ' ')}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${path.padEnd(26)} 抛出异常: ${e.message.slice(0, 70)}`)
  }
}

console.log(failed === 0 ? '\n✓ 全部通过' : `\n✗ ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
