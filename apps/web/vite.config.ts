import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  // 显式锁定根目录：从仓库根启动（npx vite --config apps/web/...）时，
  // 若不定 root，Vite 会以 CWD 为根，找不到 apps/web/index.html。
  root: rootDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    /*
     * host: true 等价于 0.0.0.0 —— 让局域网内其他设备（手机/平板/同事电脑）
     * 能通过本机 IP 访问开发服务器。默认只绑 localhost 时，别人打开
     * http://192.168.x.x:5173 是连不上的。
     */
    host: true,
    port: 5173,
    // 端口被占用时直接报错，而不是悄悄换一个 —— 否则打印出来的地址是错的
    strictPort: true,
    /*
     * 允许任意 Host 头。
     * Vite 默认拒绝非 localhost 的 Host（防 DNS rebinding），局域网访问
     * 会看到 "Blocked request. This host is not allowed."。开发环境放开即可。
     */
    allowedHosts: true,
    // 开发时把 /api 代理到本地 API 服务，前端代码里始终写相对路径 /api，
    // 这样生产环境同域部署时无需任何改动。
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
