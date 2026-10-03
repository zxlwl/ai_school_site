/**
 * 认证中间件 — 校验会话 Cookie，为受保护路由提供身份上下文。
 */

import type { Context, Next } from 'hono'
import { readSessionCookie, verifySession, type SessionPayload } from '../lib/auth'
import { fail } from '../lib/utils'

/** Hono 环境变量类型：把当前会话挂到 c.var.session */
export interface AppBindings {
  Variables: {
    session: SessionPayload
  }
}

/**
 * 要求已登录，否则 401。
 * 用于所有 /api/admin/* 写操作路由。
 */
export async function requireAuth(c: Context, next: Next) {
  const token = readSessionCookie(c.req.header('cookie'))
  const session = token ? await verifySession(token) : null

  if (!session) {
    return fail(c, 401, 'unauthorized', '登录已过期，请重新登录')
  }

  c.set('session', session)
  await next()
}

/**
 * 可选认证：已登录则注入 session，未登录也放行。
 * 用于公开接口需要根据登录态改变返回内容的场景。
 */
export async function optionalAuth(c: Context, next: Next) {
  const token = readSessionCookie(c.req.header('cookie'))
  const session = token ? await verifySession(token) : null
  if (session) c.set('session', session)
  await next()
}
