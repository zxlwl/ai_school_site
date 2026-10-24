/**
 * 本地开发 / 自托管 Node 服务器入口。
 *
 * Vercel 使用 .vercel/output 的 Build Output API 函数，
 * Cloudflare 使用 src/worker.ts，本文件只服务于本地开发和自有服务器部署（Docker / VPS）。
 */

import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
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

/**
 * 监听地址。
 *
 * 默认 0.0.0.0 而不是 127.0.0.1 —— 这样同一局域网内的手机、平板、
 * 其他电脑都能访问，是「本地给别人看」最常见的需求。
 * 只想本机访问时设 HOST=127.0.0.1。
 */
const host = process.env.HOST ?? '0.0.0.0'

/** 取本机所有非回环 IPv4，用于在启动日志里直接打印可访问地址。 */
function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address)
    }
  }
  return out
}

// 启动前自检：缺配置时给出明确指引，而不是等第一个请求才报错
if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
  console.warn(
    '\n⚠️  环境变量未完整配置。请复制 .env.example 为 .env 并填写 DATABASE_URL 与 AUTH_SECRET。\n',
  )
}

const lan = lanAddresses()

console.log(`
  学校官网 API 已启动
  ────────────────────────────────────────
  本机：    http://localhost:${port}
${lan.map((ip) => `  局域网：  http://${ip}:${port}`).join('\n')}
  健康检查：http://localhost:${port}/api/health
${host === '0.0.0.0' ? '\n  已监听 0.0.0.0，局域网内其他设备可直接访问上面的局域网地址。' : `\n  仅监听 ${host}，外部设备无法访问。`}
`)

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`  监听 ${host}:${info.port}\n`)
})
