/**
 * Vercel Serverless Function 入口。
 *
 * Vercel 的 Node Runtime 支持 Hono 的 Node 适配器，
 * 环境变量由 Vercel 项目设置注入到 process.env。
 */

import { handle } from 'hono/vercel'
import { app } from '../src/app'

export const config = {
  runtime: 'nodejs',
}

export default handle(app)
