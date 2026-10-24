/**
 * 认证中间件 — 校验会话 Cookie，为受保护路由提供身份上下文。
 *
 * 三个层次：
 *   requireAuth        仅要求已登录（任何角色）
 *   requireContentWrite 要求可写（owner / editor）
 *   requireOwner       要求超级管理员（仅 owner）
 *
 * 权限必须在**服务端**校验。前端隐藏按钮只是体验优化，
 * 真正拦住越权操作的是这里的守卫。
 */

import type { Context, Next } from 'hono'
import { canManageAccounts, canWriteContent } from '@school/shared'
import {
  readSessionCookie,
  readUserCookie,
  verifySession,
  verifyUserSession,
  type SessionPayload,
  type UserSessionPayload,
} from '../lib/auth'
import { fail } from '../lib/utils'

/** Hono 环境变量类型：把当前会话挂到 c.var.session / c.var.user */
export interface AppBindings {
  Variables: {
    session: SessionPayload
    user: UserSessionPayload
  }
}

/**
 * 要求已登录，否则 401。
 * 用于所有 /api/admin/* 读操作路由。
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
 * 要求具备内容写权限（owner / editor），否则 403。
 * 只读账号浏览后台不受影响，但任何增删改都会被挡住。
 */
export async function requireContentWrite(c: Context, next: Next) {
  const token = readSessionCookie(c.req.header('cookie'))
  const session = token ? await verifySession(token) : null

  if (!session) {
    return fail(c, 401, 'unauthorized', '登录已过期，请重新登录')
  }
  if (!canWriteContent(session.role)) {
    return fail(c, 403, 'forbidden', '当前账号为只读角色，无法修改内容')
  }

  c.set('session', session)
  await next()
}

/**
 * 要求超级管理员，否则 403。
 * 用于管理员账号管理 —— 编辑和只读都不能碰账号体系。
 */
export async function requireOwner(c: Context, next: Next) {
  const token = readSessionCookie(c.req.header('cookie'))
  const session = token ? await verifySession(token) : null

  if (!session) {
    return fail(c, 401, 'unauthorized', '登录已过期，请重新登录')
  }
  if (!canManageAccounts(session.role)) {
    return fail(c, 403, 'forbidden', '只有超级管理员可以管理账号')
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

/* ------------------------------------------------------------------ */
/* 会员（前台）                                                        */
/* ------------------------------------------------------------------ */

/** 要求会员已登录，否则 401 */
export async function requireUser(c: Context, next: Next) {
  const token = readUserCookie(c.req.header('cookie'))
  const session = token ? await verifyUserSession(token) : null

  if (!session) {
    return fail(c, 401, 'unauthorized', '请先登录')
  }

  c.set('user', session)
  await next()
}

/** 可选会员认证：登录则注入 user，未登录放行 */
export async function optionalUser(c: Context, next: Next) {
  const token = readUserCookie(c.req.header('cookie'))
  const session = token ? await verifyUserSession(token) : null
  if (session) c.set('user', session)
  await next()
}
