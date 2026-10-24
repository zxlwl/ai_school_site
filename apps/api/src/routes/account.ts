/**
 * 会员账号接口 — 前台注册 / 登录 / 登出 / 会话 / 资料 / 改密。
 *
 * 与后台管理员是**完全独立**的两套账号：
 *   /api/auth/*        → 管理员（后台）
 *   /api/account/*     → 会员（前台）
 * 两者 Cookie 名和 JWT audience 都不同，互不可冒充。
 */

import { Hono } from 'hono'
import { eq, or, sql } from 'drizzle-orm'
import type { UserProfile } from '@school/shared'
import { getDb } from '../db/client'
import { users, type UserRow } from '../db/schema'
import {
  buildClearUserCookie,
  buildUserCookie,
  hashPassword,
  readUserCookie,
  signUserSession,
  verifyPassword,
  verifyUserSession,
} from '../lib/auth'
import { fail, isSecureRequest, ok, readJson } from '../lib/utils'
import { requireUser, type AppBindings } from '../middleware/auth'

export const accountRoutes = new Hono<AppBindings>()

/* ------------------------------------------------------------------ */
/* 校验                                                                */
/* ------------------------------------------------------------------ */

/** 用户名规则：3-20 位，字母数字下划线，不能纯数字（避免和 ID 混淆） */
function validateUsername(raw: string): string | null {
  const username = raw.trim()
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{2,19}$/.test(username)) {
    return '用户名需为 3-20 位字母、数字或下划线，且以字母或下划线开头'
  }
  return null
}

function validateEmail(raw: string): string | null {
  if (!raw) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? null : '邮箱格式不正确'
}

function validatePassword(raw: string): string | null {
  if (raw.length < 8) return '密码至少需要 8 位'
  if (raw.length > 72) return '密码过长（最多 72 位）'
  return null
}

/** 数据库行 → 前端可见的公开资料（绝不带 passwordHash） */
function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.displayName,
    avatar: row.avatar,
    role: row.role === 'moderator' ? 'moderator' : 'member',
    status:
      row.status === 'muted' || row.status === 'banned' ? row.status : 'active',
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  }
}

/* ------------------------------------------------------------------ */
/* 注册                                                                */
/* ------------------------------------------------------------------ */

accountRoutes.post('/register', async (c) => {
  const body = await readJson<{
    username?: string
    password?: string
    email?: string
    displayName?: string
  }>(c)

  const username = (body?.username ?? '').trim()
  const password = body?.password ?? ''
  const email = (body?.email ?? '').trim().toLowerCase()
  const displayName = (body?.displayName ?? '').trim() || username

  for (const message of [
    validateUsername(username),
    validatePassword(password),
    validateEmail(email),
  ]) {
    if (message) return fail(c, 400, 'invalid_input', message)
  }

  const db = getDb()

  // 用户名与邮箱都要查重。分开查是为了给出准确提示，
  // 而不是笼统的「已被占用」让用户反复试。
  const byUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  if (byUsername.length) {
    return fail(c, 409, 'username_taken', '该用户名已被注册')
  }

  if (email) {
    const byEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (byEmail.length) {
      return fail(c, 409, 'email_taken', '该邮箱已被注册')
    }
  }

  const passwordHash = await hashPassword(password)

  try {
    const inserted = await db
      .insert(users)
      .values({
        username,
        email: email || null,
        passwordHash,
        displayName,
        role: 'member',
        status: 'active',
        lastLoginAt: new Date(),
      })
      .returning()

    const row = inserted[0]
    if (!row) {
      return fail(c, 500, 'create_failed', '注册失败，请稍后重试')
    }

    // 注册即登录，省去再填一次密码
    const token = await signUserSession({
      sub: String(row.id),
      username: row.username,
      role: 'member',
    })
    c.header('Set-Cookie', buildUserCookie(token, isSecureRequest(c)))

    return ok(c, { user: toProfile(row) }, 201)
  } catch (error) {
    // 并发注册撞唯一索引时的兜底
    const message = error instanceof Error ? error.message : ''
    if (/duplicate key value|unique constraint/i.test(message)) {
      return fail(c, 409, 'conflict', '用户名或邮箱已被注册')
    }
    throw error
  }
})

/* ------------------------------------------------------------------ */
/* 登录                                                                */
/* ------------------------------------------------------------------ */

accountRoutes.post('/login', async (c) => {
  const body = await readJson<{ account?: string; password?: string }>(c)
  const account = (body?.account ?? '').trim()
  const password = body?.password ?? ''

  if (!account || !password) {
    return fail(c, 400, 'invalid_body', '请输入账号和密码')
  }

  const db = getDb()
  const lower = account.toLowerCase()

  // 支持用户名或邮箱登录
  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, account), eq(users.email, lower)))
    .limit(1)

  const user = rows[0]

  // 账号不存在时也跑一次哈希比对，避免时间侧信道探测账号存在性
  const validHash =
    user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin'
  const valid = await verifyPassword(password, validHash)

  if (!user || !valid) {
    return fail(c, 401, 'invalid_credentials', '账号或密码错误')
  }

  if (user.status === 'banned') {
    return fail(c, 403, 'banned', '该账号已被封禁，如有疑问请联系管理员')
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  const token = await signUserSession({
    sub: String(user.id),
    username: user.username,
    role: user.role === 'moderator' ? 'moderator' : 'member',
  })
  c.header('Set-Cookie', buildUserCookie(token, isSecureRequest(c)))

  return ok(c, { user: toProfile(user) })
})

/* ------------------------------------------------------------------ */
/* 登出                                                                */
/* ------------------------------------------------------------------ */

accountRoutes.post('/logout', (c) => {
  c.header('Set-Cookie', buildClearUserCookie())
  return ok(c, { ok: true })
})

/* ------------------------------------------------------------------ */
/* 当前会话                                                            */
/* ------------------------------------------------------------------ */

accountRoutes.get('/session', async (c) => {
  const token = readUserCookie(c.req.header('cookie'))
  const session = token ? await verifyUserSession(token) : null

  if (!session) {
    return ok(c, { authenticated: false })
  }

  // 令牌有效不代表账号还有效：可能已被封禁或删除，
  // 所以每次都要回库确认，不能只信任 JWT 里的内容。
  const db = getDb()
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.sub)))
    .limit(1)
  const user = rows[0]

  if (!user || user.status === 'banned') {
    c.header('Set-Cookie', buildClearUserCookie())
    return ok(c, { authenticated: false })
  }

  return ok(c, { authenticated: true, user: toProfile(user) })
})

/* ------------------------------------------------------------------ */
/* 修改资料                                                            */
/* ------------------------------------------------------------------ */

accountRoutes.put('/profile', requireUser, async (c) => {
  const body = await readJson<{ displayName?: string; email?: string; avatar?: string | null }>(c)
  const session = c.get('user')
  const db = getDb()

  const rows = await db.select().from(users).where(eq(users.id, Number(session.sub))).limit(1)
  const user = rows[0]
  if (!user) return fail(c, 404, 'not_found', '账号不存在')

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body?.displayName !== undefined) {
    const displayName = body.displayName.trim()
    if (!displayName) return fail(c, 400, 'invalid_input', '显示名不能为空')
    if (displayName.length > 64) return fail(c, 400, 'invalid_input', '显示名最多 64 个字符')
    patch.displayName = displayName
  }

  if (body?.email !== undefined) {
    const email = body.email.trim().toLowerCase()
    const error = validateEmail(email)
    if (error) return fail(c, 400, 'invalid_input', error)
    if (email && email !== user.email) {
      const taken = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
      if (taken.length) return fail(c, 409, 'email_taken', '该邮箱已被其他账号使用')
    }
    patch.email = email || null
  }

  if (body?.avatar !== undefined) {
    patch.avatar = body.avatar || null
  }

  const updated = await db.update(users).set(patch).where(eq(users.id, user.id)).returning()
  return ok(c, { user: toProfile(updated[0] ?? user) })
})

/* ------------------------------------------------------------------ */
/* 修改密码                                                            */
/* ------------------------------------------------------------------ */

accountRoutes.post('/change-password', requireUser, async (c) => {
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(c)
  const currentPassword = body?.currentPassword ?? ''
  const newPassword = body?.newPassword ?? ''

  const error = validatePassword(newPassword)
  if (error) return fail(c, 400, 'weak_password', error)
  if (currentPassword === newPassword) {
    return fail(c, 400, 'invalid_input', '新密码不能与当前密码相同')
  }

  const session = c.get('user')
  const db = getDb()
  const rows = await db.select().from(users).where(eq(users.id, Number(session.sub))).limit(1)
  const user = rows[0]
  if (!user) return fail(c, 404, 'not_found', '账号不存在')

  const valid = await verifyPassword(currentPassword, user.passwordHash)
  if (!valid) return fail(c, 400, 'invalid_credentials', '当前密码不正确')

  const passwordHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id))

  return ok(c, { ok: true })
})

/* ------------------------------------------------------------------ */
/* 统计（用于后续论坛展示发帖数等，先占位返回账号基础数据）            */
/* ------------------------------------------------------------------ */

accountRoutes.get('/me', requireUser, async (c) => {
  const session = c.get('user')
  const db = getDb()
  const rows = await db.select().from(users).where(eq(users.id, Number(session.sub))).limit(1)
  const user = rows[0]
  if (!user) return fail(c, 404, 'not_found', '账号不存在')
  return ok(c, { user: toProfile(user) })
})
