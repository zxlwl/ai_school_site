#!/usr/bin/env node
/**
 * Vercel / Cloudflare 部署前自检。
 *
 * 用法：node scripts/preflight.mjs
 *
 * 检查项（均为真实部署时最容易踩的坑）：
 *   1. Serverless 函数入口存在，且相对导入能解析到真实文件
 *   2. 跨包依赖（@school/shared）导出真实 JS 而非裸 TS —— Serverless 关键
 *   3. vercel.json 的 installCommand / buildCommand 与实际构建方式一致
 *   4. 前端构建产物存在（apps/web/dist/index.html）
 *   5. 前端请求的是相对路径 /api（同域部署的前提）
 *   6. 必需的环境变量在平台侧已配置（不打印值，只报告有无）
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const notes = []

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const bad = (m) => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); problems.push(m) }
const note = (m) => { console.log(`  \x1b[33m!\x1b[0m ${m}`); notes.push(m) }
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`)

/* ---------------------------------------------------------------- */
section('1. Serverless 函数入口')

const entry = join(root, 'api', 'index.ts')
if (!existsSync(entry)) {
  bad('缺少根目录 api/index.ts —— Vercel 找不到任何函数')
} else {
  ok('根目录 api/index.ts 存在')
  // 解析其中每个相对导入，确认目标文件真实存在
  const src = readFileSync(entry, 'utf8')
  const imports = [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
  for (const spec of imports) {
    const base = resolve(dirname(entry), spec)
    const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(
      (p) => existsSync(p) && statSync(p).isFile(),
    )
    if (hit) ok(`导入可解析: ${spec} → ${hit.slice(root.length + 1)}`)
    else bad(`导入无法解析: ${spec}（Vercel 构建会报模块找不到）`)
  }
}

/* ---------------------------------------------------------------- */
section('2. 跨包依赖（Serverless 运行时关键）')

/**
 * Vercel 的函数运行时是纯 Node（默认 Node 20/22），它有两个硬性约束：
 *   1. 不能执行裸 .ts 文件
 *   2. 不跟随 npm workspaces 的 node_modules 符号链接做依赖打包
 * 因此 packages/shared 必须编译出真实的 dist/index.js，且 main/exports
 * 必须指向它，否则函数一加载就报 Cannot find module。
 */
const sharedPkgPath = join(root, 'packages', 'shared', 'package.json')
if (existsSync(sharedPkgPath)) {
  const sp = JSON.parse(readFileSync(sharedPkgPath, 'utf8'))
  const main = sp.main ?? ''
  const exp = sp.exports?.['.']
  const importTarget = typeof exp === 'string' ? exp : exp?.import ?? exp?.default ?? ''

  if (/\.ts$/.test(main)) {
    bad(`@school/shared 的 main 指向裸 TS（${main}）—— Node 运行时无法执行，函数会崩`)
  } else if (main) {
    ok(`@school/shared main = ${main}`)
  }

  if (importTarget && /\.ts$/.test(importTarget)) {
    bad(`@school/shared exports.import 指向裸 TS（${importTarget}）`)
  } else if (importTarget) {
    ok(`@school/shared exports = ${importTarget}`)
  }

  const distJs = join(root, 'packages', 'shared', 'dist', 'index.js')
  if (existsSync(distJs)) {
    ok(`编译产物存在（${statSync(distJs).size} 字节），Node 可直接加载`)
  } else {
    note('packages/shared/dist/index.js 尚未生成 —— 构建时会生成，本地验证需先 npm run build:shared')
  }

  // 确认构建脚本确实会编译 shared
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const buildScript = rootPkg.scripts?.build ?? ''
  if (/build:shared/.test(buildScript)) {
    ok(`根 build 脚本先编译 shared：${buildScript}`)
  } else {
    bad(`根 build 脚本未包含 build:shared（当前：${buildScript}）—— Vercel 上 shared 不会有产物`)
  }
} else {
  note('未找到 packages/shared（若已移除共享包可忽略）')
}

/* ---------------------------------------------------------------- */
section('3. vercel.json 配置')

const vc = join(root, 'vercel.json')
if (!existsSync(vc)) {
  bad('缺少 vercel.json')
} else {
  const cfg = JSON.parse(readFileSync(vc, 'utf8'))
  ok(`buildCommand = ${cfg.buildCommand}`)
  ok(`installCommand = ${cfg.installCommand}`)
  ok(`outputDirectory = ${cfg.outputDirectory}`)

  if (/pnpm/.test(cfg.installCommand ?? '') || /pnpm/.test(cfg.buildCommand ?? '')) {
    bad('构建命令引用了 pnpm —— Vercel 默认环境不安装 pnpm，必须改用 npm')
  } else {
    ok('构建命令使用 npm，与 Vercel 默认环境一致')
  }

  // 函数入口 path 必须在仓库内存在
  for (const p of Object.keys(cfg.functions ?? {})) {
    if (existsSync(join(root, p))) ok(`functions 入口存在: ${p}`)
    else bad(`functions 指向不存在的入口: ${p}`)
  }

  if (!cfg.rewrites?.length) bad('缺少 SPA rewrites —— 刷新 /admin 等子路由会 404')
  else ok(`SPA rewrites 已配置（${cfg.rewrites.length} 条）`)
}

// package.json 里的 packageManager 若写 pnpm 会强制 Vercel 用 pnpm
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (/^pnpm@/.test(pkg.packageManager ?? '')) {
  bad(`packageManager = ${pkg.packageManager} —— Vercel 会强制使用 pnpm 导致安装失败`)
} else {
  ok(`packageManager = ${pkg.packageManager ?? '(未设置)'}`)
}

/* ---------------------------------------------------------------- */
section('4. 前端构建产物')

const dist = join(root, 'apps', 'web', 'dist')
if (existsSync(join(dist, 'index.html'))) {
  ok(`apps/web/dist/index.html 存在（${statSync(join(dist, 'index.html')).size} 字节）`)
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  if (/src="\/assets\//.test(html) || /src="\.\/assets\//.test(html)) ok('index.html 引用了打包后的 assets')
  else note('index.html 未引用 /assets/ —— 确认构建是否完整')
} else {
  note('apps/web/dist 不存在（Vercel 构建时会生成，本地预览需先 npm run build）')
}

/* ---------------------------------------------------------------- */
section('5. 前后端同域（API 基址）')

const apiLib = join(root, 'apps', 'web', 'src', 'lib', 'api.ts')
if (existsSync(apiLib)) {
  const src = readFileSync(apiLib, 'utf8')
  const m = src.match(/const BASE\s*=\s*(.+)/)
  ok(`api.ts BASE = ${m ? m[1].trim() : '(未找到)'}`)
  if (/VITE_API_BASE/.test(src) && /['"]\/api['"]/.test(src)) {
    ok("默认 '/api' + 可选 VITE_API_BASE —— 同域部署无需配置，跨域部署可覆盖")
  } else {
    note('请确认 api.ts 默认走相对路径 /api')
  }
  if (/credentials:\s*['"]include['"]/.test(src)) ok('请求携带 credentials（Cookie 会话依赖此项）')
  else bad('缺少 credentials: include —— 登录 Cookie 不会随请求发送')
} else {
  bad('找不到 apps/web/src/lib/api.ts')
}

/* ---------------------------------------------------------------- */
section('6. 环境变量（只报告有无，不打印值）')

const REQUIRED = [
  ['DATABASE_URL', 'Postgres 连接串（Vercel 上必须用 Neon 等 HTTP 网关）'],
  ['AUTH_SECRET', 'JWT 签名密钥（至少 32 字符，务必与本地不同）'],
]
const OPTIONAL = [
  ['CORS_ORIGIN', '同域部署可留空；跨域需填前端域名，逗号分隔'],
  ['STORAGE_DRIVER', '默认 dataurl（图片存库，零依赖免信用卡）'],
]

const localEnv = {}
const envPath = join(root, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) localEnv[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  ok('本地 .env 存在（用于本地开发）')
} else {
  note('本地无 .env（本地开发需要，Vercel 上不影响）')
}

console.log('\n  在 \x1b[1mVercel → Project → Settings → Environment Variables\x1b[0m 配置以下变量：')
for (const [key, why] of REQUIRED) {
  const has = Boolean(process.env[key] || localEnv[key])
  console.log(`    ${has ? '\x1b[32m●\x1b[0m' : '\x1b[31m○\x1b[0m'} ${key.padEnd(16)} ${why}`)
}
for (const [key, why] of OPTIONAL) {
  console.log(`    \x1b[90m○\x1b[0m ${key.padEnd(16)} ${why}`)
}

if (/neon\.tech|neon\.build/.test(localEnv.DATABASE_URL ?? '')) {
  ok('本地 DATABASE_URL 指向 Neon —— Serverless 环境可直接复用')
} else if (localEnv.DATABASE_URL) {
  note('本地 DATABASE_URL 非 Neon：Vercel 函数无 TCP 长连接，请改用 Neon 连接串')
}

/* ---------------------------------------------------------------- */
console.log('\n' + '─'.repeat(64))
if (problems.length === 0) {
  console.log(`\x1b[32m自检通过\x1b[0m${notes.length ? `（${notes.length} 条提醒）` : ''}，可以部署。`)
} else {
  console.log(`\x1b[31m发现 ${problems.length} 个阻断问题：\x1b[0m`)
  for (const p of problems) console.log(`  - ${p}`)
}
console.log('─'.repeat(64) + '\n')
process.exit(problems.length ? 1 : 0)
