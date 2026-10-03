/**
 * Vercel Serverless Function 入口（根目录转发）。
 *
 * Vercel 约定：仓库根目录下 `api/` 中的每个文件对应一个函数，
 * 访问路径为 /api/<文件名>。本项目所有业务路由都已带 /api 前缀
 * （见 apps/api/src/app.ts 中 app.route('/api/...') ），
 * 而 Vercel 不会剥离这个前缀，因此 /api/index 恰好能命中全部路由：
 *
 *   /api/index       → /api/public/home   ✔ 与前台请求路径一致
 *   /api/index       → /api/auth/session  ✔ 与前台请求路径一致
 *
 * 真实实现在 apps/api/api/index.ts，这里只做转发，避免重复维护。
 */

import { handle } from 'hono/vercel'
import { app } from '../apps/api/src/app'

export const config = {
  runtime: 'nodejs',
}

export default handle(app)
