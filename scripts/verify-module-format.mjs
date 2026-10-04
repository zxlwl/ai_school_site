/**
 * 严格模拟 Vercel 运行时的模块解析，检测「ESM 源码但无 package.json」这类问题。
 *
 * 本地 Node 26 对 ESM/CJS 互操作较宽松，Vercel 的 Node 20/24 更严格。
 * 这里不靠实际 Node 版本，而是直接检查决定性事实：
 *   产物目录里若存在 `export`/`import` 语法的 .js 文件，
 *   就必须有一个声明 "type": "module" 的 package.json，否则 Node 会按 CJS 解析。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const funcDir = resolve(root, '.vercel/output/functions/index.func')

let problems = 0

// 1) 函数目录必须有 package.json 且 type = module
const pkgPath = join(funcDir, 'package.json')
let declaredModule = false
if (!existsSync(pkgPath)) {
  console.log('  ✗ 函数目录没有 package.json —— 所有 .js 会被当成 CommonJS')
  problems++
} else {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  declaredModule = pkg.type === 'module'
  console.log(
    declaredModule
      ? `  ✓ 函数目录 package.json: type = "module"`
      : `  ✗ 函数目录 package.json 的 type = ${JSON.stringify(pkg.type)}，应为 "module"`,
  )
  if (!declaredModule) problems++
}

// 2) 产物里若真有 ESM 语法，上面那条就是硬性要求
function walkJs(d, acc = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = join(d, e.name)
    if (e.isDirectory()) walkJs(p, acc)
    else if (e.name.endsWith('.js')) acc.push(p)
  }
  return acc
}

let esmFiles = 0
for (const f of walkJs(funcDir)) {
  const c = readFileSync(f, 'utf8')
  if (/^\s*export\s/m.test(c) || /^\s*import\s/m.test(c)) esmFiles++
}

console.log(`  · 产物中有 ${esmFiles} 个 .js 使用了 ESM 语法`)
if (esmFiles > 0 && !declaredModule) {
  console.log('  ✗ 存在 ESM 语法的 .js 但没有 type=module —— Vercel 上会报')
  console.log("      SyntaxError: Named export 'app' not found ... is a CommonJS module")
  problems++
}

// 3) 入口用 ESM 具名导入，确认目标确实是 ESM
const entry = readFileSync(join(funcDir, 'index.mjs'), 'utf8')
const named = [...entry.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g)]
for (const [, names, file] of named) {
  const target = join(funcDir, file)
  if (!existsSync(target)) {
    console.log(`  ✗ 入口导入的 ${file} 不存在`)
    problems++
    continue
  }
  const c = readFileSync(target, 'utf8')
  const hasEs = /^\s*export\s/m.test(c)
  console.log(
    hasEs
      ? `  ✓ 入口具名导入 {${names.trim()}} ← ./${file}（该文件是 ESM）`
      : `  ✗ 入口具名导入 ./${file}，但该文件没有 export 语句`,
  )
  if (!hasEs) problems++
}

console.log('')
if (problems) {
  console.log(`✗ 发现 ${problems} 个模块格式问题`)
  process.exit(1)
}
console.log('✓ 模块格式检查通过')
