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
section('1. Serverless 函数入口（Build Output API，仓库内无 api/ 目录）')

/*
 * ── 为什么仓库里**不能**有 api/ 目录 ───────────────────────────
 *
 * Vercel 会自动扫描仓库根的 `api/`，把其中的 .ts 当成函数入口，然后用自带
 * TypeScript 转译它。这条链路对本项目是致命的：
 *
 *   1. 转译产物写进临时目录（@vercel/node: mkdtemp(join(tmpdir(),
 *      "vercel-typescript-"))），且**只复制 .ts 文件**。
 *   2. 入口若 import 任何非 .ts 的兄弟文件（例如预打包的 .mjs），该文件
 *      不会被一起复制 → 运行时 ERR_MODULE_NOT_FOUND。
 *   3. 编译参数带 noCheck: true，不产生类型错误输出 → 失败是**静默**的，
 *      构建日志停在 "Using TypeScript x.y.z" 之后一片空白。
 *
 * 历史上因此踩过三次坑：TS2835 静默跳过、conflicting paths、以及薄壳引用
 * _bundle.mjs 在临时目录中缺失。结论是只要 api/ 存在就躲不开。
 *
 * 现方案：仓库内没有 api/，函数完全由 scripts/build-api.mjs 产出到
 * .vercel/output/functions/index.func/，Vercel 无东西可编译。
 */
const staleApi = join(root, 'api')

if (existsSync(staleApi)) {
  bad('仓库根存在 api/ 目录 —— Vercel 会扫描并强行编译其中的 .ts，'
    + '导致函数运行时解析不到同目录的 .mjs 而静默失败。请删除该目录。')
} else {
  ok('仓库根无 api/ 目录（Vercel 无从扫描，不会介入编译）')
}

const outDir = join(root, '.vercel', 'output')
const funcDir = join(outDir, 'functions', 'index.func')
const funcEntry = join(funcDir, 'index.mjs')
const vcConfig = join(funcDir, '.vc-config.json')

if (!existsSync(funcEntry)) {
  bad('缺少 .vercel/output/functions/index.func/index.mjs —— 请先运行 npm run build:api')
} else {
  const size = statSync(funcEntry).size
  ok(`函数产物存在（${(size / 1024).toFixed(1)} KB）`)

  // 产物必须是自包含的：有任何相对导入都会在 Serverless 运行时崩
  const code = readFileSync(funcEntry, 'utf8')
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

if (!existsSync(vcConfig)) {
  bad('缺少 .vc-config.json —— Vercel 不知道如何运行该函数')
} else {
  const vc = JSON.parse(readFileSync(vcConfig, 'utf8'))
  if (vc.launcherType !== 'Nodejs') bad(`launcherType 应为 Nodejs，实际 ${vc.launcherType}`)
  else ok(`.vc-config.json: runtime=${vc.runtime} handler=${vc.handler} launcherType=Nodejs`)
}

// 确认构建脚本会生成产物
const rootPkgEarly = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const buildEarly = rootPkgEarly.scripts?.build ?? ''
if (/build:api/.test(buildEarly)) {
  ok(`根 build 脚本包含 build:api：${buildEarly}`)
} else {
  bad(`根 build 脚本未包含 build:api（当前：${buildEarly}）—— Vercel 不会生成函数产物`)
}
if (/&&/.test(buildEarly) && buildEarly.indexOf('build:api') > buildEarly.indexOf('@school/web')) {
  ok('build:api 排在 web build 之后（能读到 apps/web/dist 填充 static/）')
} else if (/build:api/.test(buildEarly)) {
  bad('build:api 未排在 web build 之后 —— static/ 会拿不到前端产物，站点空白')
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

  // Build Output API 模式下不应再有 functions 字段 —— 函数由 .vercel/output 声明。
  // 保留该字段会让 Vercel 重新去扫描并编译 api/ 目录（而该目录已删除）。
  const fnKeys = Object.keys(cfg.functions ?? {})
  if (fnKeys.length) {
    bad(`vercel.json 仍声明 functions（${fnKeys.join(', ')}）—— Build Output API 模式下会让 Vercel 重新扫描 api/，请移除`)
  } else {
    ok('vercel.json 未声明 functions（函数由 .vercel/output 声明）')
  }

  /*
   * SPA 路由现在由 .vercel/output/config.json 负责（Build Output API 模式），
   * 不再写在 vercel.json 的 rewrites 里。因此这里改为检查两者之一：
   *   - 新方式：config.json 含 filesystem 路由 + SPA 兜底
   *   - 旧方式：vercel.json 含 rewrites
   */
  const buildOutputConfig = join(root, '.vercel', 'output', 'config.json')
  if (existsSync(buildOutputConfig)) {
    const bo = JSON.parse(readFileSync(buildOutputConfig, 'utf8'))
    const routes = bo.routes ?? []
    const hasFs = routes.some((r) => r.handle === 'filesystem')
    const hasApi = routes.some((r) => String(r.src).includes('/api/'))
    const hasSpa = routes.some((r) => String(r.dest) === '/index.html')
    if (hasFs && hasApi && hasSpa) {
      ok('Build Output config.json 已配置路由（filesystem → /api/* → SPA 兜底）')
    } else {
      bad(`Build Output config.json 路由不全（filesystem:${hasFs} api:${hasApi} spa:${hasSpa}）`)
    }
  } else if (!cfg.rewrites?.length) {
    bad('既无 vercel.json rewrites 也无 .vercel/output/config.json —— 刷新 /admin 等子路由会 404')
  } else {
    ok(`SPA rewrites 已配置（${cfg.rewrites.length} 条，旧方式）`)
  }

  // 切到 Build Output API 后，不能再声明 outputDirectory（会退回静态站点模式）
  if (existsSync(buildOutputConfig) && cfg.outputDirectory) {
    bad('同时存在 outputDirectory 与 Build Output API —— Vercel 会退回静态站点模式并跳过函数发现')
  } else if (existsSync(buildOutputConfig)) {
    ok('vercel.json 未声明 outputDirectory（已移交 Build Output API）')
  }
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
