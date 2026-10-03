/**
 * 一次性修复脚本：还原被「UTF-8 字节按 GBK 解码」破坏的中文。
 *
 * 成因：用 PowerShell 的 Get-Content -Raw / Set-Content -Encoding UTF8 往返时，
 * 文件被按系统 ANSI 代码页（936/GBK）解码，中文变成 鑱旂郴 这类乱码；
 * 若往返发生多次，就会叠加成多层乱码（绯荤粺 = 系统 的第二层）。
 *
 * 还原：把乱码按 GBK 编码回字节 → 按 UTF-8 解码。逐层剥离，
 * 直到文本不再包含已知乱码哨兵字符为止。
 *
 * 判定「干净」的方式不是猜，而是：还原一轮后若能成功 UTF-8 解码
 * 且不再命中哨兵集合，就认为到底了。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const FILES = [
  'apps/web/src/pages/admin/AdminDashboard.tsx',
  'apps/web/src/pages/admin/AdminPages.tsx',
  'apps/web/src/pages/admin/AdminSettings.tsx',
  'apps/api/src/routes/admin.ts',
]

/**
 * 乱码哨兵：把 UTF-8 中文字节当 GBK 读时，高频出现的字符。
 * 正常中文文案几乎不会连续命中这些字，命中即说明还有一层没剥。
 */
const SENTINELS = /[鑱鏂鍏鐢閫娴绔缃涓鍚璇瀹鏈鐨鈥鍒鍥鍔鏄璁鍙鍦鍐鍑鍗绯荤粺疆剧欑]/

const gbkDecoder = new TextDecoder('gbk', { fatal: false })

/** 反向查表：Unicode 码点 → GBK 双字节。结果缓存。 */
const gbkCache = new Map()
function gbkEncode(code) {
  if (gbkCache.has(code)) return gbkCache.get(code)
  for (let hi = 0x81; hi <= 0xfe; hi++) {
    for (let lo = 0x40; lo <= 0xfe; lo++) {
      if (lo === 0x7f) continue
      const decoded = gbkDecoder.decode(Buffer.from([hi, lo]))
      if (decoded.length === 1 && decoded.codePointAt(0) === code) {
        gbkCache.set(code, [hi, lo])
        return [hi, lo]
      }
    }
  }
  gbkCache.set(code, null)
  return null
}

/**
 * 剥离一层乱码。遇到无法反查的字符（例如 GBK 无法表示的符号、
 * 或本来就正常的拉丁字母）时，整行放弃，避免产生二次损坏。
 */
function stripOneLayer(text) {
  const bytes = []
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code < 0x80) {
      bytes.push(code)
      continue
    }
    const pair = gbkEncode(code)
    if (!pair) return null
    bytes.push(pair[0], pair[1])
  }
  const decoded = gbkDecoder.decode(Buffer.from(bytes))
  // 出现替换字符说明这层剥错了，拒绝这次结果
  if (decoded.includes('\uFFFD')) return null
  return decoded
}

/** 反复剥离，直到不再命中哨兵；最多 4 层，防止死循环。 */
function repairLine(line) {
  let current = line
  for (let depth = 0; depth < 4; depth++) {
    if (!SENTINELS.test(current)) return current
    const next = stripOneLayer(current)
    if (next === null) return current // 剥不动了，保留现状
    current = next
  }
  return current
}

let repaired = 0
for (const rel of FILES) {
  const path = join(ROOT, rel)
  // 以字节读入，去掉 BOM，避免把 U+FEFF 带进输出
  let original = readFileSync(path, 'utf8')
  if (original.charCodeAt(0) === 0xfeff) original = original.slice(1)

  if (!SENTINELS.test(original)) {
    console.log(`skip (clean): ${rel}`)
    continue
  }

  const lines = original.split('\n')
  const out = lines.map((line) => (SENTINELS.test(line) ? repairLine(line) : line))

  const result = out.join('\n')
  writeFileSync(path, result, 'utf8')
  repaired++
  const left = SENTINELS.test(result) ? ' [STILL HAS MOJIBAKE]' : ''
  console.log(`fixed: ${rel}${left}`)
}

console.log(`\n${repaired} file(s) rewritten.`)
