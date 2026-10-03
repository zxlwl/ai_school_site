/**
 * 验收 Vercel Build Output API 产物（.vercel/output/）。
 *
 * 为什么需要它：切到 Build Output API 后，vercel.json 不再声明
 * outputDirectory，前端产物必须由构建脚本自己搬进 .vercel/output/static/，
 * 函数则由 functions/index.func/ 承载。任何一环缺失都会导致「函数 404」
 * 或「页面空白」，而 Vercel 构建日志未必报错。
 *
 * 本脚本按 config.json 里的 routes 顺序在本地模拟请求分发：
 *   1. { handle: 'filesystem' }      → 在 static/ 里找文件
 *   2. { src: '/api/(.*)' }          → 交给函数
 *   3. { src: '/(.*)' }              → SPA 兜底到 /index.html
 *
 * 并且真的用纯 Node 调用函数，而不是只看文件存不存在。
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.argv[2] ?? process.cwd())
const outDir = join(root, '.vercel', 'output')
const problems = []

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const bad = (m) => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); problems.push(m) }
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`)

/* ---------------------------------------------------------------- */
section('1. Build Output 目录结构')

const configPath = join(outDir, 'config.json')
const funcDir = join(outDir, 'functions', 'index.func')
const funcEntry = join(funcDir, 'index.mjs')
const vcConfigPath = join(funcDir, '.vc-config.json')
const staticDir = join(outDir, 'static')

if (!existsSync(configPath)) bad('缺少 .vercel/output/config.json —— Vercel 不会识别为 Build Output')
else ok('config.json 存在')

if (!existsSync(funcEntry)) bad('缺少 functions/index.func/index.mjs —— 函数不存在')
else ok(`函数产物存在（${(statSync(funcEntry).size / 1024).toFixed(1)} KB）`)

if (!existsSync(vcConfigPath)) {
  bad('缺少 .vc-config.json —— Vercel 不知道如何运行该函数')
} else {
  const vc = JSON.parse(readFileSync(vcConfigPath, 'utf8'))
  ok(`.vc-config.json: runtime=${vc.runtime} handler=${vc.handler}`)
  if (vc.launcherType !== 'Nodejs') bad(`launcherType 应为 Nodejs，实际 ${vc.launcherType}`)
  else ok('launcherType = Nodejs')
}

// 切到 Build Output API 后最容易漏的一步：前端产物必须先搬进 static/
if (!existsSync(join(staticDir, 'index.html'))) {
  bad('缺少 static/index.html —— 站点会完全空白（前端产物没被复制）')
} else {
  ok(`static/index.html 存在（${statSync(join(staticDir, 'index.html')).size} 字节）`)
}

/* ---------------------------------------------------------------- */
section('2. 路由配置')

if (existsSync(configPath)) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
  if (cfg.version !== 3) bad(`version 应为 3，实际 ${cfg.version}`)
  else ok('config.json version = 3')

  const routes = cfg.routes ?? []
  const fsIdx = routes.findIndex((r) => r.handle === 'filesystem')
  const apiIdx = routes.findIndex((r) => String(r.src).includes('/api/'))
  const spaIdx = routes.findIndex((r) => String(r.dest) === '/index.html')

  if (fsIdx === -1) bad('缺少 { handle: "filesystem" } 路由 —— 静态资源不会被找到')
  else ok(`filesystem 路由在第 ${fsIdx + 1} 位`)

  if (apiIdx === -1) bad('缺少 /api/* 路由 —— 所有接口会落到 SPA 兜底并返回 HTML')
  else ok(`/api/* 路由在第 ${apiIdx + 1} 位 → ${routes[apiIdx].dest}`)

  if (spaIdx === -1) bad('缺少 SPA 兜底路由 —— 刷新 /admin 等子路由会 404')
  else ok(`SPA 兜底路由在第 ${spaIdx + 1} 位 → /index.html`)

  // 顺序至关重要：filesystem 必须先于 API，API 必须先于 SPA 兜底
  if (fsIdx !== -1 && apiIdx !== -1 && fsIdx > apiIdx) {
    bad('filesystem 路由排在 /api/* 之后 —— 静态资源会被函数抢走')
  }
  if (apiIdx !== -1 && spaIdx !== -1 && apiIdx > spaIdx) {
    bad('/api/* 路由排在 SPA 兜底之后 —— 接口会被 SPA 吞掉，永远 404')
  }
}

/* ---------------------------------------------------------------- */
section('3. 函数实际调用（纯 Node，不用 tsx）')

if (existsSync(funcEntry)) {
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    ok('已从 .env 注入环境变量')
  }

  const mod = await import(pathToFileURL(funcEntry).href)
  if (typeof mod.default !== 'function') {
    bad(`default 导出不是函数（${typeof mod.default}）—— 调用时会 500`)
  } else {
    ok('default 导出是函数')
    const probes = [
      ['/api/health', 200],
      ['/api/public/home', 200],
      ['/api/public/navigation', 200],
      ['/api/auth/session', 200],
      ['/api/admin/stats', 401],
    ]
    for (const [path, expect] of probes) {
      try {
        const res = await mod.default(new Request(`https://school.example.com${path}`))
        const body = await res.text()
        if (res.status === expect) {
          ok(`${path.padEnd(24)} ${res.status}  ${body.slice(0, 44).replace(/\s+/g, ' ')}`)
        } else {
          bad(`${path.padEnd(24)} ${res.status}（期望 ${expect}）${body.slice(0, 80)}`)
        }
      } catch (e) {
        bad(`${path.padEnd(24)} 抛出异常: ${e.message.slice(0, 70)}`)
      }
    }
  }
}

/* ---------------------------------------------------------------- */
console.log('\n' + '─'.repeat(60))
if (problems.length === 0) console.log('\x1b[32mBuild Output 验收通过\x1b[0m')
else {
  console.log(`\x1b[31m发现 ${problems.length} 个问题：\x1b[0m`)
  for (const p of problems) console.log(`  - ${p}`)
}
console.log('─'.repeat(60) + '\n')
process.exit(problems.length ? 1 : 0)
