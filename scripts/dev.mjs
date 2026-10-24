/**
 * 跨平台一键启动开发环境：同时跑 API 与前端。
 *
 * 为什么不用 `npm run dev:api & npm run dev:web`：
 *   `&` 是 POSIX shell 的语法，Windows 的 cmd 完全不认；
 *   在 PowerShell 里 `&` 是调用运算符，含义完全不同。
 * 所以用一个 Node 脚本来 spawn 两个子进程，三平台行为一致。
 *
 * 用法：
 *   npm run dev              # 默认
 *   npm run dev -- --host    # 透传给 Vite
 *
 * 任一子进程退出时，另一个也一并结束，避免留下孤儿进程占着端口。
 */

import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const API_PORT = Number(process.env.PORT ?? 8787)
// 前端端口取自 vite.config.ts 的 server.port，这里只用于打印，保持一致即可
const WEB_PORT = 5173

/** 取本机非回环 IPv4，用于告诉用户局域网该怎么访问。 */
function lanAddresses() {
  const out = []
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address)
    }
  }
  return out
}

const children = []

function run(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    // Windows 上 npm 是 .cmd 包装脚本，必须 shell:true 才能执行
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  })

  child.on('exit', (code) => {
    // 一个挂了就把另一个也收掉：否则端口被占着，下次启动会莫名失败
    for (const other of children) {
      if (other !== child && !other.killed) other.kill()
    }
    if (code !== 0 && code !== null) {
      console.error(`\n✗ ${name} 退出，代码 ${code}\n`)
      process.exitCode = code
    }
  })

  child.on('error', (error) => {
    console.error(`\n✗ 无法启动 ${name}：${error.message}\n`)
    process.exitCode = 1
  })

  children.push(child)
  return child
}

// API：tsx watch，监听 0.0.0.0 以便局域网访问
run('API', 'npm', ['--workspace', '@school/api', 'run', 'dev'], {
  PORT: String(API_PORT),
  HOST: '0.0.0.0',
})

// 前端：Vite，host 已在 vite.config.ts 里设为 true
run('前端', 'npm', ['--workspace', '@school/web', 'run', 'dev'])

const lan = lanAddresses()

setTimeout(() => {
  console.log(`
  ────────────────────────────────────────────────────────
   开发环境已启动

   本机访问：
     前端  http://localhost:${WEB_PORT}
     接口  http://localhost:${API_PORT}/api/health

   局域网访问（手机 / 同事电脑）：
${lan.length ? lan.map((ip) => `     http://${ip}:${WEB_PORT}`).join('\n') : '     未检测到局域网地址'}
${
  lan.length
    ? `
   注意：前端页面走的是 /api 相对路径，Vite 会代理到本机 ${API_PORT} 端口，
   所以别人访问时不需要额外配置，直接打开上面的地址即可。
`
    : ''
}
   按 Ctrl+C 停止全部服务。
  ────────────────────────────────────────────────────────
`)
}, 2500)

// Ctrl+C 时确保两个子进程都被结束
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      if (!child.killed) child.kill()
    }
    process.exit(0)
  })
}
