/**
 * Vercel Serverless Function 入口。
 *
 * Vercel 约定：仓库根目录下 `api/` 中的每个文件对应一个函数，
 * 访问路径为 /api/<文件名>。本项目所有业务路由都已带 /api 前缀
 * （见 apps/api/src/app.ts 中 app.route('/api/...') ），
 * 而 Vercel 不会剥离这个前缀，因此 /api/index 恰好能命中全部路由：
 *
 *   /api/index  →  /api/public/home    ✔ 与前台请求路径一致
 *   /api/index  →  /api/auth/session   ✔ 与前台请求路径一致
 *
 * ─────────────────────────────────────────────────────────────
 * 【重要】本文件必须保持"薄壳"，不要直接 import 后端源码。
 *
 * 原因：Vercel 一旦发现本入口，就会用自带的 TypeScript 环境按
 * moduleResolution=node16 编译这个文件**及其整条依赖树**。而
 * apps/api 源码使用无扩展名相对导入（如 '../lib/utils'），在 node16
 * 下会报 TS2835，导致函数打包被静默跳过 —— 部署日志仍显示
 * "Build Completed"，但 /api/* 全部 404，极难排查。
 *
 * 因此真实实现由 esbuild 预打包为 ./index.mjs（见
 * scripts/build-api.mjs），本文件只做转发。该 .mjs 是自包含产物：
 * 零相对导入、零 require，仅引用 npm 包名，Vercel 无需再编译任何 TS。
 *
 * 修改后端代码后必须重新运行：
 *     npm run build:api
 * 该命令已包含在根 `npm run build` 中，Vercel 构建时会自动执行。
 * ─────────────────────────────────────────────────────────────
 */

import handler from './index.mjs'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

export default handler
