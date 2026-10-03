/**
 * 本地开发 / 自托管 Node 服务器入口。
 *
 * Vercel 使用 api/index.ts，Cloudflare 使用 src/worker.ts，
 * 本文件只服务于本地开发和自有服务器部署（Docker / VPS）。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { app } from './app'

/**
 * 手动加载仓库根目录的 .env（避免为本地开发引入 dotenv 依赖）。
 * 已存在的真实环境变量优先，不会被文件覆盖。
 */
function loadEnv(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  for (const file of ['.env', '.env.local']) {
    try {
      const content = readFileSync(join(root, file), 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx === -1) continue
        const key = trimmed.slice(0, idx).trim()
        let value = trimmed.slice(idx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      /* 文件不存在时跳过 */
    }
  }
}

loadEnv()

const port = Number(process.env.PORT ?? 8787)

// 启动前自检：缺配置时给出明确指引，而不是等第一个请求才报错
if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
  console.warn(
    '\n⚠️  环境变量未完整配置。请复制 .env.example 为 .env 并填写 DATABASE_URL 与 AUTH_SECRET。\n',
  )
}

console.log(`
  学校官网 API 已启动
  ────────────────────────────────────────
  地址：   http://localhost:${port}
  健康检查：http://localhost:${port}/api/health
  用户接口：http://localhost:${port}/api/public/home
`)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`  监听端口 ${info.port}\n`)
})
