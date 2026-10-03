/**
 * Hono 应用装配 — 路由挂载、CORS、错误处理。
 *
 * 该文件不绑定任何运行时，Vercel / Cloudflare / Node 三个入口都复用它。
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { publicRoutes } from './routes/public'
import { uploadRoutes } from './routes/upload'
import { fail } from './lib/utils'

export interface Env {
  DATABASE_URL?: string
  AUTH_SECRET?: string
  CORS_ORIGIN?: string
  STORAGE_DRIVER?: string
  S3_ENDPOINT?: string
  S3_REGION?: string
  S3_BUCKET?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_PUBLIC_BASE_URL?: string
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>()

  /* -------------------------------------------------------------- */
  /* 全局中间件                                                      */
  /* -------------------------------------------------------------- */

  app.use('*', secureHeaders({ xFrameOptions: false }))

  /**
   * CORS：前后端分离部署时前端域名与 API 域名不同，必须放行。
   * CORS_ORIGIN 支持逗号分隔的多个域名；设为 * 则放行全部（配 credentials 时
   * 浏览器不允许 * ，因此会回显请求来源）。
   */
  app.use('/api/*', async (c, next) => {
    const configured = (c.env?.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '').trim()
    const origin = c.req.header('origin') ?? ''

    const allowAll = configured === '*' || configured === ''
    const allowed = configured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const allowOrigin = allowAll ? origin || '*' : allowed.includes(origin) ? origin : allowed[0] ?? ''

    return cors({
      origin: allowOrigin,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Filename'],
      exposeHeaders: ['Content-Length'],
      credentials: true,
      maxAge: 86400,
    })(c, next)
  })

  /* -------------------------------------------------------------- */
  /* 健康检查                                                        */
  /* -------------------------------------------------------------- */

  app.get('/api/health', (c) =>
    c.json({
      data: {
        ok: true,
        service: 'school-site-api',
        runtime: typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
          ? 'cloudflare-workers'
          : 'node',
        time: new Date().toISOString(),
      },
    }),
  )

  app.get('/', (c) =>
    c.json({
      data: {
        name: '学校官网 API',
        version: '1.0.0',
        endpoints: {
          public: '/api/public/*',
          auth: '/api/auth/*',
          admin: '/api/admin/*',
          upload: '/api/upload',
        },
      },
    }),
  )

  /* -------------------------------------------------------------- */
  /* 业务路由                                                        */
  /* -------------------------------------------------------------- */

  app.route('/api/public', publicRoutes)
  app.route('/api/auth', authRoutes)
  app.route('/api/admin', adminRoutes)
  app.route('/api/upload', uploadRoutes)

  /* -------------------------------------------------------------- */
  /* 兜底                                                            */
  /* -------------------------------------------------------------- */

  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) {
      return fail(c, 404, 'not_found', `接口不存在：${c.req.method} ${c.req.path}`)
    }
    return c.text('Not Found', 404)
  })

  app.onError((error, c) => {
    console.error('[api error]', error)

    const message = error instanceof Error ? error.message : '未知错误'

    // 配置类错误直接暴露原因，方便部署时快速定位
    if (/DATABASE_URL|AUTH_SECRET/.test(message)) {
      return fail(c, 500, 'configuration_error', message)
    }

    // 唯一约束冲突给出可读提示
    if (/duplicate key value|unique constraint/i.test(message)) {
      return fail(c, 409, 'conflict', '存在重复数据，请检查名称或标识是否已被占用')
    }

    return fail(c, 500, 'internal_error', message)
  })

  return app
}

export const app = createApp()
