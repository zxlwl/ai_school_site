/// <reference types="vite/client" />

/**
 * 应用用到的环境变量。Vite 只会注入以 VITE_ 开头的变量，这里显式声明，
 * 避免 `import.meta.env.VITE_API_BASE` 报 TS2339。
 */
interface ImportMetaEnv {
  /** 后端 API 基地址；留空则走同源 /api（配合 vercel.json 重写或 Cloudflare 路由） */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
