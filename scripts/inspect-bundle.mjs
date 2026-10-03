import { readFileSync } from 'node:fs'

const s = readFileSync('api/index.mjs', 'utf8')

console.log('=== 产物中所有 import 来源（运行时真实外部依赖）===')
const set = new Set()
for (const m of s.matchAll(/^\s*import\s[^;]*?from\s*['"]([^'"]+)['"]/gm)) set.add(m[1])
for (const m of s.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) set.add(m[1])
for (const x of [...set].sort()) console.log('  ' + x)
console.log('--- 共 ' + set.size + ' 个')

console.log('\n=== 产物中的动态 import / createRequire ===')
for (const m of s.matchAll(/import\s*\(/g)) console.log('  动态 import 出现 ' + 1 + ' 次')
const dyn = [...s.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
console.log('  动态 import 目标: ' + (dyn.length ? [...new Set(dyn)].join(', ') : '无'))

console.log('\n=== CJS / 路径相关标识符计数 ===')
for (const k of ['require(', '__dirname', '__filename', 'import.meta.url', 'process.cwd']) {
  const n = s.split(k).length - 1
  console.log('  ' + k.padEnd(18) + n)
}

console.log('\n=== 是否残留裸 TS 引用 ===')
for (const k of ["@school/shared", "from '../", 'from "./', "from '../apps"]) {
  console.log('  ' + k.padEnd(20) + (s.split(k).length - 1))
}

console.log('\n产物总行数: ' + s.split('\n').length)
console.log('产物字节数: ' + Buffer.byteLength(s, 'utf8'))
