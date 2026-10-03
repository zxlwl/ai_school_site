/**
 * api/index.mjs 的类型声明。
 *
 * api/index.mjs 由 scripts/build-api.mjs 用 esbuild 生成，
 * 内容是自包含的 Vercel 函数处理器（Vercel 的 Node 运行时签名）。
 *
 * 这里手写声明，避免 TypeScript 在 node16 解析模式下对 .mjs 报
 * TS7016（Could not find a declaration file）。
 */

type VercelHandler = (request: Request) => Response | Promise<Response>

declare const handler: VercelHandler
export default handler
