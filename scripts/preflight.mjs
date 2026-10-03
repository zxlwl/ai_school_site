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

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
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
section('1. Serverless 函数入口（预打包产物链）')

/*
 * 本项目刻意把函数实现「预打包」成 api/_bundle.mjs，而不是让 Vercel 直接
 * 编译 api/index.ts 的 TS 依赖树。原因：Vercel 会用 moduleResolution=node16
 * 编译入口及其全部依赖，而 apps/api 源码使用无扩展名相对导入，会报 TS2835；
 * 该错误不中断部署（仍显示 Build Completed），但函数被静默跳过 → /api/* 全 404。
 *
 * 产物为何不叫 index.mjs：Vercel CLI 会报
 *   Error: Two or more files have conflicting paths or names.
 *   The path "api/index.mjs" has conflicts with "api/index.ts".
 * 两者去掉扩展名后同名，被判为同一路径的两个函数，构建直接失败。
 * 故产物改名 _bundle.mjs（下划线前缀 = 非路由文件）。
 *
 * 因此这里必须检查三件套齐备，缺一不可：
 *   api/index.ts      → 薄壳入口（Vercel 唯一认的函数入口）
 *   api/_bundle.mjs   → 真正的实现（构建产物，但必须入库）
 *   api/_bundle.d.mts → 薄壳导入 .mjs 时的类型声明，缺了会 TS7016
 */
const entry = join(root, 'api', 'index.ts')
const bundle = join(root, 'api', '_bundle.mjs')
const bundleTypes = join(root, 'api', '_bundle.d.mts')

// 命名冲突检查：api/ 下不能有两个「去掉扩展名后同名」的真函数文件。
// 注意 *声明文件*（*.d.ts / *.d.mts / *.d.cts）不算函数候选，必须排除 ——
// 否则 _bundle.mjs 与 _bundle.d.mts 会被误判为冲突。
const apiDir = join(root, 'api')
if (existsSync(apiDir)) {
  const stems = {}
  const candidates = []
  for (const f of readdirSync(apiDir)) {
    // 跳过声明文件与下划线前缀的非路由文件
    if (/\.d\.(ts|mts|cts)$/i.test(f)) continue
    if (f.startsWith('_')) continue
    const m = f.match(/^(.+?)(\.[a-z]+)$/i)
    if (!m) continue
    candidates.push(f)
    ;(stems[m[1]] ??= []).push(f)
  }
  const conflicts = Object.entries(stems).filter(([, files]) => files.length > 1)
  for (const [, files] of conflicts) {
    bad(`api/ 下函数入口命名冲突: ${files.join(' 与 ')} —— Vercel 会报 conflicting paths，构建直接失败`)
  }
  if (!conflicts.length) ok(`api/ 下无函数入口冲突（函数候选: ${candidates.join(', ') || '无'}）`)
}

if (!existsSync(entry)) {
  bad('缺少根目录 api/index.ts —— Vercel 找不到任何函数')
} else {
  ok('根目录 api/index.ts 存在（函数入口）')

  if (!existsSync(bundle)) {
    bad('缺少 api/_bundle.mjs —— 请先运行 npm run build:api')
  } else {
    const size = statSync(bundle).size
    ok(`api/_bundle.mjs 存在（${(size / 1024).toFixed(1)} KB，预打包的实现）`)

    // 产物必须是自包含的：有任何相对导入都会在 Serverless 运行时崩
    const code = readFileSync(bundle, 'utf8')
    const relImports = code.match(/^\s*(?:import|export)[^;]*?from\s*['"]\.\.?\//gm)
    if (relImports) {
      bad(`产物含 ${relImports.length} 处相对导入 —— Serverless 运行时无法解析，请重新 npm run build:api`)
    } else {
      ok('产物自包含：无相对导入')
    }

    // @school/shared 以裸 TS 发布，必须已被内联进产物
    if (/from\s*['"]@school\/shared['"]/.test(code)) {
      bad('产物仍引用 @school/shared —— 该包发布裸 TS，函数加载即崩')
    } else {
      ok('产物已内联 @school/shared（无裸 TS 引用）')
    }

    // 中文曾被 PowerShell 往返读写破坏过，这里留一道防线
    const fffd = [...code.matchAll(/\uFFFD/g)].length
    if (fffd > 0) bad(`产物含 ${fffd} 个 U+FFFD 替换字符，中文已损坏，请重新 build:api`)
    else ok('产物编码无损（U+FFFD: 0）')

    // 默认导出必须是函数，否则调用时 500
    if (/export\s*\{[^}]*\bdefault\b[^}]*\}/.test(code) || /export\s+default\b/.test(code)) {
      ok('产物已导出 default 处理器')
    } else {
      bad('产物未导出 default 处理器')
    }
  }

  if (!existsSync(bundleTypes)) {
    note('缺少 api/_bundle.d.mts —— 本地 tsc 可能报 TS7016（Vercel 通常不启用 strict 仍可构建）')
  } else {
    ok('api/_bundle.d.mts 存在（.mjs 导入的类型声明）')
  }

  // 薄壳不应再直接引用后端源码，否则 Vercel 又会去编译整条 TS 依赖树
  const src = readFileSync(entry, 'utf8')
  const srcImports = [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
  const leaksSource = srcImports.filter((s) => !/\.mjs$/.test(s))
  if (leaksSource.length) {
    bad(`api/index.ts 直接导入了源码 ${leaksSource.join(', ')} —— 会触发 Vercel 的 node16 编译（TS2835）`)
  } else {
    ok(`api/index.ts 仅导入预打包产物（${srcImports.join(', ') || '无'}）`)
  }

  // 薄壳导入的目标必须真实存在，且必须是 _bundle.mjs（不能是 index.mjs，那会命名冲突）
  const mjsImport = srcImports.find((s) => /\.mjs$/.test(s))
  if (mjsImport === './index.mjs') {
    bad('api/index.ts 导入了 ./index.mjs —— 与 index.ts 同名，Vercel 会报 conflicting paths')
  } else if (mjsImport && existsSync(resolve(dirname(entry), mjsImport))) {
    ok(`薄壳导入目标存在: ${mjsImport}`)
  } else if (mjsImport) {
    bad(`薄壳导入目标不存在: ${mjsImport}`)
  }

  // 确认构建脚本会生成产物
  const rootPkgEarly = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const buildEarly = rootPkgEarly.scripts?.build ?? ''
  if (/build:api/.test(buildEarly)) {
    ok(`根 build 脚本包含 build:api：${buildEarly}`)
  } else {
    bad(`根 build 脚本未包含 build:api（当前：${buildEarly}）—— Vercel 不会生成函数产物`)
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

  // 入口必须是 .ts —— Vercel 会忽略 api/ 下的 .mjs/.mts 作为函数入口
  const fnKeys = Object.keys(cfg.functions ?? {})
  if (fnKeys.some((k) => /\.mjs$|\.mts$/.test(k))) {
    bad('functions 入口用了 .mjs/.mts —— Vercel 会忽略这些扩展名，函数不会被注册')
  } else if (fnKeys.length) {
    ok(`函数入口扩展名为 Vercel 可识别类型（${fnKeys.join(', ')}）`)
  }

  // includeFiles 确保预打包产物随函数一起上传（.mjs 被忽略但仍是运行时依赖）
  const inc = fnKeys.map((k) => cfg.functions[k]?.includeFiles).filter(Boolean)
  if (inc.some((v) => String(v).includes('_bundle.mjs'))) {
    ok('includeFiles 已声明 api/_bundle.mjs —— 产物会随函数上传')
  } else if (inc.some((v) => String(v).includes('index.mjs'))) {
    bad('includeFiles 指向 api/index.mjs —— 该文件已改名 _bundle.mjs，会有命名冲突')
  } else if (fnKeys.length) {
    note('未声明 includeFiles: api/_bundle.mjs —— 若函数运行时找不到该文件请补上')
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
