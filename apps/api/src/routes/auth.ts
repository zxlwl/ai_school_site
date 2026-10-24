/**
 * 认证接口 — 登录、登出、会话状态、修改密码。
 */

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { admins } from '../db/schema'
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  buildClearCookie,
  buildSessionCookie,
  hashPassword,
  readSessionCookie,
  signSession,
  verifyPassword,
  verifySession,
} from '../lib/auth'
import { fail, isSecureRequest, ok, readJson } from '../lib/utils'
import { requireAuth, type AppBindings } from '../middleware/auth'

export const authRoutes = new Hono<AppBindings>()

/**
 * 首次访问时确保存在管理员账号。
 * 使用 ON CONFLICT DO NOTHING 保证并发安全，不会覆盖已改过的密码。
 */
async function ensureAdmin(): Promise<void> {
  const db = getDb()
  const existing = await db.select({ id: admins.id }).from(admins).limit(1)
  if (existing.length > 0) return

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD)
  await db
    .insert(admins)
    .values({
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
      displayName: '管理员',
      mustChangePassword: true,
    })
    .onConflictDoNothing()
}

/* ------------------------------------------------------------------ */
/* 登录                                                                */
/* ------------------------------------------------------------------ */

authRoutes.post('/login', async (c) => {
  const body = await readJson<{ password?: string; username?: string }>(c)
  const password = body?.password ?? ''
  const username = (body?.username ?? DEFAULT_ADMIN_USERNAME).trim()

  if (!password) {
    return fail(c, 400, 'invalid_body', '请输入管理员密码')
  }

  await ensureAdmin()
  const db = getDb()

  const rows = await db.select().from(admins).where(eq(admins.username, username)).limit(1)
  const admin = rows[0]

  // 用户不存在时也执行一次哈希比对，避免通过响应时间探测账号是否存在
  const validHash = admin?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin'
  const valid = await verifyPassword(password, validHash)

  if (!admin || !valid) {
    return fail(c, 401, 'invalid_credentials', '密码错误')
  }

  // 停用的账号可以保留记录但不能登录。放在密码校验之后判断，
  // 避免通过「停用」提示反推出账号是否存在。
  if (!admin.active) {
    return fail(c, 403, 'account_disabled', '该账号已被停用，请联系超级管理员')
  }

  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id))

  const role =
    admin.role === 'owner' || admin.role === 'editor' || admin.role === 'viewer'
      ? admin.role
      : 'viewer'

  const token = await signSession({
    sub: String(admin.id),
    username: admin.username,
    mcp: admin.mustChangePassword,
    role,
  })

  c.header('Set-Cookie', buildSessionCookie(token, isSecureRequest(c)))
  return ok(c, { ok: true, mustChangePassword: admin.mustChangePassword, role })
})

/* ------------------------------------------------------------------ */
/* 登出                                                                */
/* ------------------------------------------------------------------ */

authRoutes.post('/logout', (c) => {
  c.header('Set-Cookie', buildClearCookie())
  return ok(c, { ok: true })
})

/* ------------------------------------------------------------------ */
/* 会话状态                                                            */
/* ------------------------------------------------------------------ */

authRoutes.get('/session', async (c) => {
  const token = readSessionCookie(c.req.header('cookie'))
  const session = token ? await verifySession(token) : null

  if (!session) {
    return ok(c, { authenticated: false, mustChangePassword: false })
  }

  // 回库确认账号仍然存在且未被停用：令牌有效不等于账号可用。
  const db = getDb()
  const rows = await db
    .select({
      id: admins.id,
      username: admins.username,
      displayName: admins.displayName,
      role: admins.role,
      active: admins.active,
      mustChangePassword: admins.mustChangePassword,
    })
    .from(admins)
    .where(eq(admins.id, Number(session.sub)))
    .limit(1)
  const admin = rows[0]

  if (!admin || !admin.active) {
    c.header('Set-Cookie', buildClearCookie())
    return ok(c, { authenticated: false, mustChangePassword: false })
  }

  const role =
    admin.role === 'owner' || admin.role === 'editor' || admin.role === 'viewer'
      ? admin.role
      : 'viewer'

  return ok(c, {
    authenticated: true,
    mustChangePassword: admin.mustChangePassword,
    username: admin.username,
    displayName: admin.displayName,
    role,
  })
})

/* ------------------------------------------------------------------ */
/* 修改密码                                                            */
/* ------------------------------------------------------------------ */

authRoutes.post('/change-password', requireAuth, async (c) => {
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(c)
  const currentPassword = body?.currentPassword ?? ''
  const newPassword = body?.newPassword ?? ''

  if (newPassword.length < 8) {
    return fail(c, 400, 'weak_password', '新密码至少需要 8 位')
  }
  if (newPassword === DEFAULT_ADMIN_PASSWORD) {
    return fail(c, 400, 'weak_password', '不能继续使用初始密码，请更换')
  }

  const db = getDb()
  const session = c.get('session')
  const rows = await db.select().from(admins).where(eq(admins.id, Number(session.sub))).limit(1)
  const admin = rows[0]

  if (!admin) {
    return fail(c, 401, 'unauthorized', '账号不存在')
  }

  const valid = await verifyPassword(currentPassword, admin.passwordHash)
  if (!valid) {
    return fail(c, 400, 'invalid_credentials', '当前密码不正确')
  }

  const passwordHash = await hashPassword(newPassword)
  await db
    .update(admins)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(admins.id, admin.id))

  // 重新签发令牌，清掉 mcp 标记
  const token = await signSession({
    sub: String(admin.id),
    username: admin.username,
    mcp: false,
    role:
      admin.role === 'owner' || admin.role === 'editor' || admin.role === 'viewer'
        ? admin.role
        : 'viewer',
  })
  c.header('Set-Cookie', buildSessionCookie(token, isSecureRequest(c)))

  return ok(c, { ok: true })
})
