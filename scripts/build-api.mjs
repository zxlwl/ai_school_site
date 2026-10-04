#!/usr/bin/env node
/**
 * 用 tsc 编译后端，然后用纯 Node 把产物整理成 Vercel Build Output API 形态。
 *
 * ── 为什么不用 esbuild ────────────────────────────────────────────
 * 之前用 esbuild 把后端打成单文件。esbuild 是**原生二进制**包，构建时需要
 * 派生子进程执行平台相关的可执行文件。在 Vercel 构建机上这条路径反复失败，
 * 且失败是静默的（日志停在 `> node scripts/build-api.mjs` 后无输出）。
 *
 * 现在的方案完全不依赖原生二进制：
 *   tsc（纯 JS）编译 → 纯 Node 脚本搬运 → .vercel/output/
 *
 * ── 关键处理：相对导入补扩展名 ────────────────────────────────────
 * 源码里 31 处相对导入都没写扩展名（`./routes/admin`）。tsc 的 NodeNext 模式
 * 不会自动补，产出 ESM 后 Node 会直接 ERR_MODULE_NOT_FOUND。
 * 两种解法：
 *   a) 改 31 处源码加 `.js` —— 侵入大，且要改所有文件
 *   b) 编译后统一重写产物 —— 集中一处，源码保持干净
 * 这里选 b。
 *
 * ── 输出结构 ─────────────────────────────────────────────────────
 *   .vercel/output/
 *   ├── config.json
 *   ├── functions/index.func/
 *   │   ├── .vc-config.json
 *   │   ├── index.mjs          入口（薄壳，re-export app.ts 编译产物）
 *   │   ├── app.js
 *   │   ├── routes/…  lib/…  db/…  middleware/…
 *   │   └── node_modules/      仅函数运行需要的运行时依赖
 *   └── static/                前端产物
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiRoot = join(root, 'apps', 'api')
const buildDir = join(apiRoot, 'dist')

const outDir = join(root, '.vercel', 'output')
const funcDir = join(outDir, 'functions', 'index.func')
const staticDir = join(outDir, 'static')

const step = (msg) => console.log(`[build-api] ${msg}`)

/** 函数运行时真正需要的外部依赖（其余一律不带） */
const RUNTIME_DEPS = [
  'hono',
  '@hono/zod-validator',
  'drizzle-orm',
  'postgres',
  '@neondatabase/serverless',
  'bcryptjs',
  'jose',
  'zod',
]

step(`Node ${process.version} / ${process.platform}-${process.arch}`)

// ── 1. 校验编译产物存在 ──────────────────────────────────────────
if (!existsSync(join(buildDir, 'app.js'))) {
  console.error(`✗ 找不到编译产物: ${buildDir}/app.js`)
  console.error('  请先运行: npm --workspace @school/api run build')
  process.exit(1)
}

// ── 2. 重建输出目录 ─────────────────────────────────────────────
step('重建 .vercel/output/ …')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(funcDir, { recursive: true })
mkdirSync(staticDir, { recursive: true })

// ── 3. 搬运编译产物到函数目录 ───────────────────────────────────
step('搬运后端编译产物…')
let copied = 0
for (const entry of readdirSync(buildDir, { withFileTypes: true })) {
  if (entry.name === 'server.local.js' || entry.name === 'worker.js') continue // 本地/Cloudflare 专用，不进 Vercel 函数
  cpSync(join(buildDir, entry.name), join(funcDir, entry.name), { recursive: true })
  copied++
}
step(`  已搬运 ${copied} 项`)

// ── 4. 给产物的相对导入补 .js 扩展名 ────────────────────────────
step('修正相对导入扩展名…')
let fixedFiles = 0
let fixedSpecs = 0

function walkJs(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      walkJs(p, acc)
    } else if (e.name.endsWith('.js')) acc.push(p)
  }
  return acc
}

for (const file of walkJs(funcDir)) {
  const before = readFileSync(file, 'utf8')
  // 匹配 from './x' / from "../y" / import('./z')，补 .js（跳过已有扩展名的）
  const after = before.replace(
    /((?:from|import)\s*\(?\s*['"])(\.\.?\/[^'"]+?)(['"])/g,
    (full, pre, spec, post) => {
      if (/\.(js|mjs|cjs|json)$/.test(spec)) return full
      fixedSpecs++
      return `${pre}${spec}.js${post}`
    },
  )
  if (after !== before) {
    writeFileSync(file, after)
    fixedFiles++
  }
}
step(`  修正 ${fixedFiles} 个文件、${fixedSpecs} 处导入`)

// ── 5. 写函数入口（薄壳）────────────────────────────────────────
step('写入函数入口 index.mjs …')

/*
 * ── 函数目录必须自带 package.json ───────────────────────────────
 *
 * apps/api/package.json 里写着 "type": "module"，tsc 编出的 dist/*.js 都是
 * 标准 ESM（`export const app = createApp()`）。但产物被搬到
 * .vercel/output/functions/index.func/ 之后，那个目录里**没有 package.json**，
 * Node 找不到 "type": "module"，就按 CommonJS 解析所有 .js。
 *
 * 后果是 Vercel 上加载入口直接崩：
 *   SyntaxError: Named export 'app' not found. The requested module './app.js'
 *   is a CommonJS module, which may not support all module.exports as named exports.
 *
 * 注意这个坑在本地很难发现：Node 版本越新，对 ESM/CJS 互操作的判定越宽松，
 * 本地（Node 26）能跑，Vercel（Node 20/24）就崩。所以必须显式声明。
 */
writeFileSync(
  join(funcDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
)

writeFileSync(
  join(funcDir, 'index.mjs'),
  `// 由 scripts/build-api.mjs 自动生成，请勿手动编辑。
// 真正的实现在 app.js（apps/api/src/app.ts 的编译产物）。
import { handle } from 'hono/vercel'
import { app } from './app.js'

export const config = { runtime: 'nodejs' }
export default handle(app)
`,
)

// ── 6. 复制运行时依赖 ───────────────────────────────────────────
step('复制运行时依赖…')
const funcNodeModules = join(funcDir, 'node_modules')
mkdirSync(funcNodeModules, { recursive: true })

let depCount = 0
const seen = new Set()

/** 递归复制一个包及其全部依赖（读它的 package.json dependencies） */
function copyPackage(name, fromDir) {
  if (seen.has(name)) return
  seen.add(name)

  const srcPkg = join(fromDir, name)
  if (!existsSync(srcPkg)) return

  const destPkg = join(funcNodeModules, name)
  mkdirSync(dirname(destPkg), { recursive: true })
  cpSync(srcPkg, destPkg, { recursive: true, dereference: true })
  depCount++

  // 继续复制它的依赖
  let pkgJson
  try {
    pkgJson = JSON.parse(readFileSync(join(srcPkg, 'package.json'), 'utf8'))
  } catch {
    return
  }
  for (const dep of Object.keys(pkgJson.dependencies || {})) {
    // 优先在同级 node_modules 找，找不到再回到根
    const localDir = existsSync(join(dirname(srcPkg), dep)) ? dirname(srcPkg) : join(root, 'node_modules')
    copyPackage(dep, localDir)
  }
}

for (const dep of RUNTIME_DEPS) {
  copyPackage(dep, join(root, 'node_modules'))
}

/*
 * ── @school/shared 必须手工放进去 ────────────────────────────────
 * 它是 npm workspace，在 node_modules 里只是个符号链接；Vercel 不会把
 * 工作区的软链内容上传到函数目录，运行时就会 Cannot find package。
 *
 * 好在它的构建产物是**单文件、零外部依赖**（packages/shared/dist/index.js，
 * 无相对导入、无 require、无 import.meta），直接拷一份即可。
 */
const sharedDist = join(root, 'packages', 'shared', 'dist', 'index.js')
if (!existsSync(sharedDist)) {
  console.error('✗ 找不到 @school/shared 编译产物 —— 请先运行 npm run build:shared')
  process.exit(1)
}
const sharedDir = join(funcNodeModules, '@school', 'shared')
mkdirSync(join(sharedDir, 'dist'), { recursive: true })
cpSync(sharedDist, join(sharedDir, 'dist', 'index.js'))
writeFileSync(
  join(sharedDir, 'package.json'),
  JSON.stringify(
    {
      name: '@school/shared',
      version: '1.0.0',
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.js',
      exports: { '.': './dist/index.js' },
    },
    null,
    2,
  ) + '\n',
)
depCount++

step(`  已复制 ${depCount} 个包（含手写的 @school/shared 运行时副本）`)

// ── 7. 写 .vc-config.json ───────────────────────────────────────
/*
 * ── runtime 版本必须跟着 Vercel 的停用节奏走 ────────────────────
 *
 * @vercel/build-utils 的 fs/node-version.js 里写着每个大版本的 discontinueDate：
 *   nodejs24.x  （当前最新）
 *   nodejs22.x
 *   nodejs20.x  discontinueDate: 2026-10-01   ← 已停用
 *   nodejs18.x  discontinueDate: 2025-09-01
 * 而 collect-build-result/validate-build-result.js 的 SUPPORTED_AL2023_RUNTIMES
 * 只列了 nodejs20.x / nodejs22.x / nodejs24.x。
 *
 * 所以 nodejs20.x 虽然仍能通过校验，但已过停用日，部署时会打印：
 *   "You are using a custom Runtime that depends on nodejs20.x,
 *    which is discontinued. Please upgrade your Runtime..."
 * 这里直接用 24.x。
 */
const RUNTIME = 'nodejs24.x'

/*
 * ── useWebApi 是关键，漏了就 500 ────────────────────────────────
 *
 * NodejsLambda 的签名是 (req, res) => void，返回值会被直接丢弃。
 * 而 hono/vercel 的 handle(app) 返回的是 Web `fetch` 风格函数 (req) => Response，
 * 两者不匹配。只写 shouldAddHelpers 的话，Vercel 运行时会把我们的返回值扔掉，
 * 请求既不写响应也不结束，最终卡到 300 秒超时：
 *   WARN: default export returned a `Response`.
 *   The default-export signature is `(req, res) => void` — returns are ignored.
 *   Vercel Runtime Timeout Error: Task timed out after 300 seconds
 *
 * 打开开关后，getLambdaEnvironment()（@vercel/build-utils）才会注入
 * VERCEL_USE_WEB_API=1，运行时改按 Web fetch 语义调用：
 *   lambda.useWebApi === true && (environment.VERCEL_USE_WEB_API = "1")
 */
writeFileSync(
  join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: RUNTIME,
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
      useWebApi: true,
    },
    null,
    2,
  ) + '\n',
)

// ── 8. 写 config.json ───────────────────────────────────────────
/*
 * 路由顺序至关重要：
 *   1. /                       —— 根路径显式给前端（见下方说明）
 *   2. filesystem              —— 静态资源优先，否则前端 assets 会被函数抢走
 *   3. /api/(.*)               —— 所有接口交给函数
 *   4. /(.*)                   —— 其余交给 SPA 兜底，否则刷新 /admin 等子路由会 404
 *
 * ── dest 必须写 '/index'，不是 '/api/index'（踩过的坑）──────────
 *
 * Build Output API 里函数的标识就是目录名去掉 .func：
 *     functions/index.func/  →  函数名 "index"
 * dest 的第一段是**函数名**，不是路径分组：
 *     { src: '/api/(.*)', dest: '/index' }        ✓
 *     { src: '/api/(.*)', dest: '/api/index' }    ✗ 被当成名为 "api" 的函数
 *
 * 写错的表现非常迷惑，因为函数其实加载成功了、只是接不到请求：
 *     /            → 返回函数根路由的 JSON（函数确实在跑）
 *     /api         → SPA HTML
 *     /api/health  → 404 NOT_FOUND（dest 指向不存在的函数 "api"）
 * 看上去像"前端坏了 / 静态产物没传"，实际是路由 dest 写错。
 *
 * 用 dest: '/index' 时不带捕获组，Vercel 会把**原始路径原样**交给函数，
 * 所以函数收到的仍是 /api/health —— 这正是 Hono 注册路由时用的前缀
 * （前端 BASE = '/api' 也是同一约定）。
 *
 * ── 为什么第一条必须显式写 '/'（踩过的坑）───────────────────────
 *
 * 只有 { handle: 'filesystem' } + {'/api/(.*)'} + {'/(.*)'} 时，线上表现是：
 *     /index.html      → HTML   （filesystem 命中静态文件 ✓）
 *     /anything-else   → HTML   （SPA 兜底正常 ✓）
 *     /                → 函数根路由 JSON  ✗ 唯独根路径跑进了函数
 *
 * 子路径都对、只有 '/' 出错，是因为根路径会先被拿去匹配函数；
 * 在 filesystem 之前显式声明 '/' 就能把它钉死在前端。
 * 注意 '/index.html' 由 filesystem 自动处理，不需要也不应该单独列规则。
 */
writeFileSync(
  join(outDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/', dest: '/index.html' },
        { handle: 'filesystem' },
        { src: '/api/(.*)', dest: '/index' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ) + '\n',
)

// ── 9. 复制前端静态文件 ─────────────────────────────────────────
/*
 * Build Output API 模式下前端产物不会被自动带上，而第一条路由
 * { handle: 'filesystem' } 只查 .vercel/output/static/。
 * 不复制的结果是：函数能跑、整站空白。
 */
const webDist = join(root, 'apps', 'web', 'dist')
if (!existsSync(join(webDist, 'index.html'))) {
  console.error(`✗ 找不到前端产物: ${webDist}/index.html`)
  console.error('  请确认根 build 脚本中「前端构建」排在 build:api 之前')
  process.exit(1)
}
cpSync(webDist, staticDir, { recursive: true })

function countFiles(dir) {
  let n = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(join(dir, e.name))
    else if (e.isFile()) n++
  }
  return n
}

// ── 10. 汇总 ────────────────────────────────────────────────────
const funcSize = countFiles(funcDir)
console.log('')
console.log('✓ 已生成 Build Output API 产物: .vercel/output/')
console.log(`    functions/index.func/  （${funcSize} 个文件，运行时依赖 ${depCount} 个）`)
console.log('    config.json            （路由：静态 → /api/* → SPA 兜底）')
console.log(`    static/                （前端 ${countFiles(staticDir)} 个文件，含 index.html）`)
