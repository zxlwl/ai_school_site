/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers 入口。
 *
 * 环境变量通过 wrangler.toml 的 [vars] 或 Dashboard 的 Worker 变量注入，
 * 由 Hono 的 c.env 提供。为了让不接收 c.env 的工具函数（如数据库、JWT）
 * 也能读到配置，这里在每次请求前把它们同步进 process.env。
 *
 * 注意：Workers 无 TCP socket，DATABASE_URL 必须是 Neon（或其它 HTTP 网关）连接串。
 * 图片默认走 dataurl 驱动，无需 R2 等需要绑定信用卡的对象存储。
 */

import { app, type Env } from './app'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 把 Worker 绑定同步到 process.env，供 getDb() / getSecret() 读取
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') {
        process.env[key] = value
      }
    }

    return app.fetch(request, env, ctx)
  },
}
