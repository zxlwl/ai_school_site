#!/usr/bin/env node
/**
 * 把后端 API 预打包成单文件 JS，供 Vercel Serverless 使用。
 *
 * ── 为什么需要这一步 ────────────────────────────────────────────
 * Vercel 一旦发现 api/index.ts，就会用自带的 TypeScript 环境按
 * moduleResolution=node16 编译这个入口**及其整条依赖树**。而本项目
 * apps/api 源码使用无扩展名相对导入（如 '../lib/utils'），在 node16 下
 * 会报：
 *     TS2835: Relative import paths need explicit file extensions in
 *             ECMAScript imports when '--moduleResolution' is 'node16'
 * 该错误**不会中断部署**（日志仍显示 "Build Completed" + "Deployment
 * completed"），但函数打包被静默跳过，结果是 /api/* 全部 404 —— 极难排查。
 *
 * 因此我们主动用 esbuild 把整个后端打成一个自包含的 .mjs：零相对导入、
 * 零 require，只引用 npm 包名。Vercel 面对的是纯 JS，不再触发它自己的
 * TS 编译链路。
 *
 * ── 产物与入口的协作方式 ───────────────────────────────────────
 *   真实实现 → api/_bundle.mjs  （本脚本生成，已提交入库）
 *   函数入口 → api/index.ts     （薄壳，只 re-export 上面这个产物）
 *
 * ⚠ 产物为何不叫 index.mjs？
 *   Vercel CLI 会报「Two or more files have conflicting paths or names」——
 *   api/index.mjs 与 api/index.ts 去掉扩展名后同名，被判为同一路径的两个
 *   函数，构建直接失败（实测 CLI 62.1.0）。因此产物必须换名。
 *   选 _bundle.mjs 而非 bundle.mjs：下划线前缀是 Vercel 约定的「非路由文件」
 *   标记，能确保它不被当成第二个函数入口。
 *
 * 为什么入口不直接 import 后端源码？因为那样 Vercel 又会去编译整条 TS
 * 依赖树，绕回原问题。薄壳方案下，Vercel 编译 api/index.ts 时只看到一个
 * 指向 .mjs 的导入，配合 _bundle.d.mts 类型声明即可零报错通过。
 *
 * ── 修改后端代码后 ─────────────────────────────────────────────
 *   npm run build:api
 * 该命令已包含在根 `npm run build` 中，Vercel 构建时会自动执行。
 */

import { build } from 'esbuild'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'api', '_bundle.mjs')
const realApp = join(root, 'apps', 'api', 'src', 'app.ts')

if (!existsSync(realApp)) {
  console.error(`✗ 找不到后端应用: ${realApp}`)
  process.exit(1)
}

// 清理旧产物，避免用陈旧的 bundle 部署
rmSync(outfile, { force: true })

/*
 * 虚拟入口：直接交给 esbuild 一段源码，而不是让磁盘上的 api/index.ts
 * 充当入口。
 *
 * 这样做是为了彻底消除"自引用"：薄壳 api/index.ts 里写着
 * `import handler from './index.mjs'`，若拿它当打包入口，esbuild 就会去
 * 解析这个指向「正在生成的产物」的导入 —— 而它刚被删掉，必然报
 *     Could not resolve "./index.mjs"
 * 用 stdin 喂一段干净的入口源码，语义清晰且没有任何循环。
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
  const result = await build({
    stdin: {
      contents: virtualEntry,
      resolveDir: join(root, 'api'),
      sourcefile: 'vercel-entry.ts',
      loader: 'ts',
    },
    outfile,
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

  const size = statSync(outfile).size
  const inputs = Object.keys(result.metafile.inputs)
  const bundled = inputs.filter((p) => !p.includes('node_modules') && p !== 'vercel-entry.ts')
  console.log(`✓ 后端函数已打包: api/_bundle.mjs (${(size / 1024).toFixed(1)} KB)`)
  console.log(`  内联源文件 ${bundled.length} 个，外部依赖 ${EXTERNAL.length} 个`)

  const code = readFileSync(outfile, 'utf8')

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
} catch (err) {
  console.error('✗ 打包失败:')
  console.error(err.message)
  process.exit(1)
}
