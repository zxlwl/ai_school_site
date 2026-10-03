/**
 * 诊断脚本：在不泄露密码的前提下，显示 .env 中 DATABASE_URL 指向的数据库。
 * 用法：node scripts/check-env.mjs   （在仓库根目录执行）
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
  console.log('DATABASE_URL 为空 —— 需要填写')
  process.exit(0)
}

try {
  const parsed = new URL(url)
  console.log('协议    :', parsed.protocol)
  console.log('主机    :', parsed.hostname)
  console.log('端口    :', parsed.port || '(默认)')
  console.log('数据库  :', parsed.pathname.replace(/^\//, ''))
  console.log('参数    :', parsed.search || '(无)')
  const placeholder = /ep-xxx|:password@|example\.com/i.test(url)
  console.log('仍为模板占位 :', placeholder ? '是 —— 请替换为真实连接串' : '否')
} catch {
  console.log('无法解析为 URL，原值长度', url.length)
}
