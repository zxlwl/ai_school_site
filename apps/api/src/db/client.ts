/**
 * 数据库连接层 — 同时兼容 Node（Vercel / 本地）与 Cloudflare Workers。
 *
 * 驱动选择策略：
 * - 若 DATABASE_URL 指向 Neon（含 neon.tech），使用 @neondatabase/serverless 的
 *   HTTP 驱动。它在 Workers 与 Node 下都能工作，且单次请求即一次 HTTPS 调用，
 *   没有连接池耗尽的顾虑，是 serverless 场景最省心的选择。
 * - 否则回退到 postgres.js（本地 Postgres / Supabase pooler / 其他托管库）。
 *   该驱动仅在 Node 运行时可用，Workers 下会明确报错而不是静默失败。
 *
 * 注意：Cloudflare Workers 无法使用 TCP socket，因此部署到 Workers 时必须使用
 * Neon 或提供 HTTP 兼容的 Postgres 网关。
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { drizzle as drizzleNeonHttp } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

let cached: Database | null = null

/** 判断当前是否运行在 Cloudflare Workers 环境 */
export function isWorkersRuntime(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.userAgent === 'Cloudflare-Workers'
  )
}

function resolveDriver(url: string): 'neon' | 'postgres-js' {
  // Neon 的连接串统一走 serverless HTTP 驱动，Node 与 Workers 通用
  if (/neon\.tech|neon\.build/.test(url)) return 'neon'
  return 'postgres-js'
}

/**
 * 获取数据库实例（进程内单例）。
 * @param url 连接串，缺省读取 process.env.DATABASE_URL
 */
export function getDb(url?: string): Database {
  if (cached && !url) return cached

  const connectionString = url ?? process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL 未配置。请在 .env（本地）或平台环境变量（Vercel / Cloudflare）中设置 Postgres 连接串。',
    )
  }

  const driver = resolveDriver(connectionString)

  if (driver === 'neon') {
    // Neon 走 HTTP 驱动，Node 与 Workers 通用，无需连接池
    const client = neon(connectionString)
    const db = drizzleNeonHttp(client, { schema }) as unknown as Database
    if (!url) cached = db
    return db
  }

  if (isWorkersRuntime()) {
    throw new Error(
      '当前部署在 Cloudflare Workers，但 DATABASE_URL 不是 Neon 连接串。' +
        'Workers 无法建立 TCP 连接，请改用 Neon（免费版无需信用卡）或其它 HTTP 兼容的 Postgres 服务。',
    )
  }

  const client = postgres(connectionString, {
    max: 1, // serverless 场景下每实例一个连接即可，避免打爆数据库连接数
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // 兼容 Supabase / PgBouncer 事务模式
  })
  const db = drizzlePostgresJs(client, { schema }) as unknown as Database
  if (!url) cached = db
  return db
}

/** 允许在测试或多租户场景下注入自定义数据库实例 */
export function setDb(db: Database | null): void {
  cached = db
}

export { schema }
