/**
 * 冒烟测试：直接验证 DATABASE_URL 指向的 Neon 库能否用 HTTP 驱动连上。
 * 这里刻意不 import 项目 TS 源码（node 原生剥离要求写全扩展名），
 * 只验证「驱动 + 连接串 + 查询」这条链路本身是否通。
 *
 * 用法：node scripts/smoke-db.mjs
 */

import { readFileSync } from 'node:fs'

function readEnvValue(key) {
  let content = ''
  try {
    content = readFileSync('.env', 'utf8')
  } catch {
    return ''
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    if (trimmed.slice(0, idx).trim() !== key) continue
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  return ''
}

const url = readEnvValue('DATABASE_URL')
if (!url) {
  console.error('❌ DATABASE_URL 为空')
  process.exit(1)
}

const isNeon = /neon\.tech|neon\.build/.test(url)
console.log('驱动选择:', isNeon ? 'neon-http' : 'postgres-js')

if (!isNeon) {
  console.log('（非 Neon 连接串，跳过 HTTP 驱动测试）')
  process.exit(0)
}

const { neon } = await import('@neondatabase/serverless')
const sql = neon(url)

try {
  const rows = await sql`select 1 as ok, current_database() as db`
  console.log('✓ 连接成功:', JSON.stringify(rows[0]))

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `
  const names = tables.map((r) => r.table_name)
  console.log('✓ public 下的表:', names.length ? names.join(', ') : '(空 —— 需要先跑 push.ts)')
} catch (error) {
  console.error('❌ 连接失败:', error instanceof Error ? error.message : error)
  process.exit(1)
}
