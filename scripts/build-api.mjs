#!/usr/bin/env node
/**
 * 把后端 API 打包成 Vercel Serverless 函数（Build Output API 形态）。
 *
 * ── 为什么要自己打包，而不是让 Vercel 编译 api/ 目录 ──────────────
 * Vercel 会自动扫描仓库根目录的 `api/` 并把其中的 .ts 文件当作函数入口，
 * 然后用自带的 TypeScript 环境转译它。这条链路对本项目是**致命**的：
 *
 *   1. 转译产物被写进临时目录（@vercel/node 里的
 *      mkdtemp(join(tmpdir(), "vercel-typescript-"))），只复制 .ts 文件。
 *   2. 若入口 import 了任何非 .ts 的同目录文件（例如预打包好的 .mjs），
 *      该文件**不会**被一起复制过去。
 *   3. 运行时解析该 import 直接 ERR_MODULE_NOT_FOUND。
 *   4. 且编译时传了 noCheck: true，不产生类型错误输出 —— 失败是**静默**的：
 *      构建日志停在 "Using TypeScript x.y.z (local user-provided)" 后一片空白。
 *
 * 换句话说：只要仓库里存在 `api/` 目录，Vercel 就会介入编译，无论入口写成
 * 什么样都躲不开。任何"薄壳 + 预打包"的组合都会踩到第 2 步。
 *
 * ── 本方案 ─────────────────────────────────────────────────────
 * 仓库里**不放 `api/` 目录**。函数完全由本脚本产出到 Vercel 官方推荐的
 * Build Output API 目录结构中：
 *
 *   .vercel/output/
 *   ├── config.json                        顶层路由
 *   ├── functions/index.func/
 *   │   ├── .vc-config.json                运行时配置
 *   │   └── index.mjs                      函数实现（esbuild 打包产物）
 *   └── static/                            前端产物（必须显式复制）
 *
 * Vercel 没有 `api/` 可扫描，就完全没有机会介入编译；它只按 config.json
 * 分发请求。这是目前唯一稳定可控的形态。
 *
 * ── 修改后端代码后 ─────────────────────────────────────────────
 *   npm run build:api
 * 该命令已包含在根 `npm run build` 中，Vercel 构建时会自动执行。
 */

import { build } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const realApp = join(root, 'apps', 'api', 'src', 'app.ts')

/** 产物直接落在这里，不经过任何中间目录，也不写入 api/ */
const outDir = join(root, '.vercel', 'output')
const funcDir = join(outDir, 'functions', 'index.func')
const funcEntry = join(funcDir, 'index.mjs')

if (!existsSync(realApp)) {
  console.error(`✗ 找不到后端应用: ${realApp}`)
  process.exit(1)
}

/*
 * 仓库里若残留 api/ 目录会重新触发 Vercel 的编译链路（见文件头说明），
 * 因此这里主动拦截而不是静默通过 —— 这是个必须让人知道的约束。
 */
const staleApiDir = join(root, 'api')
if (existsSync(staleApiDir)) {
  console.error('✗ 仓库根目录存在 api/ 目录')
  console.error('  Vercel 会自动扫描它并强行编译其中的 .ts，导致函数在运行时')
  console.error('  解析不到同目录的 .mjs 而静默失败。请删除该目录：')
  console.error(`      rm -rf ${staleApiDir}`)
  process.exit(1)
}

/*
 * 虚拟入口：直接交给 esbuild 一段源码，而不是读磁盘上的某个入口文件。
 *
 * 这样做有两个好处：
 *   1. 不需要仓库里有 api/index.ts（那正是要消灭的东西）；
 *   2. 语义清晰 —— 入口内容一目了然，且不存在任何自引用风险。
 */
const virtualEntry = `
import { handle } from 'hono/vercel'
import { app } from ${JSON.stringify(realApp.replace(/\\/g, '/'))}

export const config = { runtime: 'nodejs' }
export default handle(app)
`

/*
 * 这些依赖保持 external（不打进产物）：
 *   - @neondatabase/serverless / postgres：运行时按 DATABASE_URL 二选一，
 *     且都是 CJS/原生混合包，内联反而容易出错
 *   - bcryptjs / jose / drizzle-orm / hono / zod：同理，保持外部引用更稳，
 *     Vercel 会从 node_modules 正常解析
 * 其余全部内联，**包括 @school/shared** —— 这是关键：该包过去以裸 TS
 * 形式发布，Serverless 运行时无法解析，必须打进产物。
 */
const EXTERNAL = [
  '@neondatabase/serverless',
  'postgres',
  'bcryptjs',
  'jose',
  'drizzle-orm',
  'hono',
  'zod',
]

try {
  // 整体重建，避免陈旧产物混入新部署
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(funcDir, { recursive: true })

  const result = await build({
    stdin: {
      contents: virtualEntry,
      resolveDir: root,
      sourcefile: 'vercel-entry.ts',
      loader: 'ts',
    },
    outfile: funcEntry,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: EXTERNAL,
    banner: {
      js: '/* 由 scripts/build-api.mjs 自动生成，请勿手动编辑。请改 apps/api/src/ 下的源码后重新运行 npm run build:api。 */',
    },
    legalComments: 'none',
    logLevel: 'warning',
    metafile: true,
  })

  const size = statSync(funcEntry).size
  const inputs = Object.keys(result.metafile.inputs)
  const bundled = inputs.filter((p) => !p.includes('node_modules') && p !== 'vercel-entry.ts')
  console.log(`✓ 后端函数已打包 (${(size / 1024).toFixed(1)} KB)`)
  console.log(`  内联源文件 ${bundled.length} 个，外部依赖 ${EXTERNAL.length} 个`)

  const code = readFileSync(funcEntry, 'utf8')

  // 安全检查 1：不能残留 @school/shared 裸引用（它以裸 TS 发布，运行时解析不了）
  const bare = code.match(/from\s*['"]@school\/shared['"]/g)
  if (bare) {
    console.error(`✗ 产物中仍有 ${bare.length} 处 @school/shared 裸引用，Serverless 运行时无法解析`)
    process.exit(1)
  }
  console.log('  ✓ 无 @school/shared 裸引用')

  // 安全检查 2：不能残留相对导入（同上，运行时找不到 .ts 源文件）
  const rel = code.match(/^\s*(?:import|export)[^;]*?from\s*['"]\.\.?\//gm)
  if (rel) {
    console.error(`✗ 产物中仍有 ${rel.length} 处相对导入: ${rel.slice(0, 3).join(' | ')}`)
    process.exit(1)
  }
  console.log('  ✓ 无相对导入残留')

  // 安全检查 3：必须真的导出了默认处理器，否则函数调用时会 500
  if (!/export\s*\{[^}]*\bdefault\b[^}]*\}/.test(code) && !/export\s+default\b/.test(code)) {
    console.error('✗ 产物未导出 default 处理器，Vercel 调用时会失败')
    process.exit(1)
  }
  console.log('  ✓ default 处理器已导出')

  // 安全检查 4：确认编码无损（历史上被 PowerShell 破坏过中文）
  const bad = [...code.matchAll(/\uFFFD/g)].length
  if (bad > 0) {
    console.error(`✗ 产物含 ${bad} 个 U+FFFD 替换字符，中文可能已损坏`)
    process.exit(1)
  }
  console.log('  ✓ 编码无损（U+FFFD: 0）')

  /*
   * .vc-config.json 告知 Vercel 如何运行这个函数。
   *   runtime: nodejs20.x —— 走 Node 运行时（非 Edge）
   *   handler: index.mjs —— 入口文件名（相对函数目录）
   *   launcherType: Nodejs —— 用 Node 启动器，它会把默认导出当作
   *     Web Request handler 调用
   */
  writeFileSync(
    join(funcDir, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs20.x',
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        shouldAddHelpers: true,
      },
      null,
      2,
    ) + '\n',
  )

  /*
   * 顶层 config.json：声明路由。
   *
   * 顺序至关重要：
   *   1. filesystem  —— 静态资源优先，否则前端 assets 会被函数抢走
   *   2. /api/(.*)   —— 所有接口交给函数
   *   3. /(.*)       —— 其余交给 SPA 兜底，否则刷新 /admin 等子路由会 404
   * 若把第 3 条排在前面，接口会被 SPA 吞掉并永远返回 HTML。
   */
  writeFileSync(
    join(outDir, 'config.json'),
    JSON.stringify(
      {
        version: 3,
        routes: [
          { handle: 'filesystem' },
          { src: '/api/(.*)', dest: '/api/index' },
          { src: '/(.*)', dest: '/index.html' },
        ],
      },
      null,
      2,
    ) + '\n',
  )

  console.log(`  ✓ 已生成 Build Output API 产物: .vercel/output/`)
  console.log(`    functions/index.func/  （函数，${(size / 1024).toFixed(1)} KB）`)
  console.log(`    config.json            （路由：静态 → /api/* → SPA 兜底）`)

  /*
   * ── 复制前端静态文件 ──────────────────────────────────────────
   *
   * 致命细节：Build Output API 模式下，前端产物**不会**被自动带上。
   * 而 config.json 的第一条路由是 { handle: 'filesystem' }，它只会去
   * .vercel/output/static/ 找文件。若不复制，结果是：函数能跑、但整个
   * 站点空白（连 index.html 都没有）。
   *
   * 因此这里必须把 apps/web/dist 完整搬进 static/。
   */
  const staticDir = join(outDir, 'static')
  const webDist = join(root, 'apps', 'web', 'dist')

  if (!existsSync(join(webDist, 'index.html'))) {
    console.error(`✗ 找不到前端产物: ${webDist}/index.html`)
    console.error('  请确认根 build 脚本中「前端构建」排在 build:api 之前')
    process.exit(1)
  }

  mkdirSync(staticDir, { recursive: true })
  copyDirSync(webDist, staticDir)

  const staticFiles = countFiles(staticDir)
  console.log(`    static/                （前端 ${staticFiles} 个文件，含 index.html）`)
} catch (err) {
  console.error('✗ 打包失败:')
  console.error(err.message)
  process.exit(1)
}

/** 递归复制目录（Node 18+ 的 cpSync 在部分平台对符号链接行为不一致，这里手写更稳） */
function copyDirSync(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dest = join(to, entry.name)
    if (entry.isDirectory()) copyDirSync(src, dest)
    else if (entry.isFile()) copyFileSync(src, dest)
  }
}

/** 统计目录下文件总数 */
function countFiles(dir) {
  let n = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(join(dir, entry.name))
    else if (entry.isFile()) n++
  }
  return n
}
