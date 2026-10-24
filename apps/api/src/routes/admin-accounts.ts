/**
 * 管理员账号管理接口 — 仅超级管理员（owner）可用。
 *
 * 挂在 /api/admin/accounts，在 /api/admin 之前注册，
 * 这样 owner 守卫不会被 adminRoutes 的 requireAuth 覆盖。
 *
 * ── 三条防自锁规则（都在服务端强制）────────────────────────────────
 * 1. 不能停用自己
 * 2. 不能把自己降级成非 owner
 * 3. 不能删除最后一个可用的 owner
 *
 * 这三条是人最容易在后台点出来、又最难恢复的操作（一旦全员失去
 * owner，就只能改数据库）。所以宁可保守，直接拒绝。
 */

import { Hono } from 'hono'
import { and, eq, ne, or } from 'drizzle-orm'
import type { AdminAccount, AdminRole } from '@school/shared'
import { getDb } from '../db/client'
import { admins, type AdminRow } from '../db/schema'
import { hashPassword } from '../lib/auth'
import { fail, ok, readJson } from '../lib/utils'
import { requireOwner, type AppBindings } from '../middleware/auth'

export const adminAccountRoutes = new Hono<AppBindings>()

adminAccountRoutes.use('*', requireOwner)

function normalizeRole(value: unknown, fallback: AdminRole = 'editor'): AdminRole {
  return value === 'owner' || value === 'editor' || value === 'viewer' ? value : fallback
}

/** 数据库行 → 对外结构（绝不带 passwordHash） */
function toAccount(row: AdminRow): AdminAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: normalizeRole(row.role, 'owner'),
    active: row.active,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 统计当前可用（active 且 owner）的账号数，用于判断是否允许降级 */
async function countActiveOwners(excludeId?: number): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ id: admins.id })
    .from(admins)
    .where(
      excludeId === undefined
        ? and(eq(admins.role, 'owner'), eq(admins.active, true))
        : and(eq(admins.role, 'owner'), eq(admins.active, true), ne(admins.id, excludeId)),
    )
  return rows.length
}

function validateUsername(raw: string): string | null {
  const username = raw.trim()
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{2,31}$/.test(username)) {
    return '用户名需为 3-32 位字母、数字或下划线，且以字母或下划线开头'
  }
  return null
}

function validatePassword(raw: string): string | null {
  if (raw.length < 8) return '密码至少需要 8 位'
  if (raw.length > 72) return '密码过长（最多 72 位）'
  return null
}

/* ------------------------------------------------------------------ */
/* 列表                                                                */
/* ------------------------------------------------------------------ */

adminAccountRoutes.get('/', async (c) => {
  const db = getDb()
  const rows = await db.select().from(admins).orderBy(admins.id)
  return ok(c, rows.map(toAccount))
})

/* ------------------------------------------------------------------ */
/* 新建                                                                */
/* ------------------------------------------------------------------ */

adminAccountRoutes.post('/', async (c) => {
  const body = await readJson<{
    username?: string
    password?: string
    displayName?: string
    role?: AdminRole
    active?: boolean
  }>(c)

  const username = (body?.username ?? '').trim()
  const password = body?.password ?? ''
  const displayName = (body?.displayName ?? '').trim() || username
  const role = normalizeRole(body?.role, 'editor')
  const active = body?.active ?? true

  const usernameError = validateUsername(username)
  if (usernameError) return fail(c, 400, 'invalid_input', usernameError)
  const passwordError = validatePassword(password)
  if (passwordError) return fail(c, 400, 'invalid_input', passwordError)

  const db = getDb()
  const existing = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1)
  if (existing.length) {
    return fail(c, 409, 'username_taken', '该用户名已存在')
  }

  const passwordHash = await hashPassword(password)
  const inserted = await db
    .insert(admins)
    .values({
      username,
      passwordHash,
      displayName,
      role,
      active,
      // 新建账号默认要求首次登录改密，避免管理员代设的密码长期流通
      mustChangePassword: true,
    })
    .returning()

  const row = inserted[0]
  if (!row) return fail(c, 500, 'create_failed', '创建失败，请稍后重试')
  return ok(c, toAccount(row), 201)
})

/* ------------------------------------------------------------------ */
/* 编辑                                                                */
/* ------------------------------------------------------------------ */

adminAccountRoutes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return fail(c, 400, 'invalid_id', '账号 ID 不合法')
  }

  const body = await readJson<{
    displayName?: string
    role?: AdminRole
    active?: boolean
    password?: string
  }>(c)

  const session = c.get('session')
  const selfId = Number(session.sub)
  const isSelf = id === selfId

  const db = getDb()
  const rows = await db.select().from(admins).where(eq(admins.id, id)).limit(1)
  const target = rows[0]
  if (!target) return fail(c, 404, 'not_found', '账号不存在')

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body?.displayName !== undefined) {
    const displayName = body.displayName.trim()
    if (!displayName) return fail(c, 400, 'invalid_input', '显示名不能为空')
    if (displayName.length > 64) return fail(c, 400, 'invalid_input', '显示名最多 64 个字符')
    patch.displayName = displayName
  }

  if (body?.role !== undefined) {
    const role = normalizeRole(body.role, normalizeRole(target.role, 'owner'))
    if (isSelf && role !== 'owner') {
      return fail(c, 400, 'cannot_demote_self', '不能降低自己的权限，请让其他超级管理员操作')
    }
    if (normalizeRole(target.role, 'owner') === 'owner' && role !== 'owner') {
      const remaining = await countActiveOwners(id)
      if (remaining === 0) {
        return fail(c, 400, 'last_owner', '至少要保留一个超级管理员，否则将无人能管理系统')
      }
    }
    patch.role = role
  }

  if (body?.active !== undefined) {
    if (isSelf && !body.active) {
      return fail(c, 400, 'cannot_disable_self', '不能停用自己的账号')
    }
    if (!body.active) {
      const remaining = await countActiveOwners(id)
      if (normalizeRole(target.role, 'owner') === 'owner' && remaining === 0) {
        return fail(c, 400, 'last_owner', '至少要保留一个可用的超级管理员')
      }
    }
    patch.active = body.active
  }

  if (body?.password !== undefined && body.password !== '') {
    const passwordError = validatePassword(body.password)
    if (passwordError) return fail(c, 400, 'invalid_input', passwordError)
    patch.passwordHash = await hashPassword(body.password)
    // 管理员重置了密码：强制对方下次登录再改一次
    patch.mustChangePassword = true
  }

  const updated = await db.update(admins).set(patch).where(eq(admins.id, id)).returning()
  const row = updated[0]
  if (!row) return fail(c, 500, 'update_failed', '更新失败，请稍后重试')
  return ok(c, toAccount(row))
})

/* ------------------------------------------------------------------ */
/* 删除                                                                */
/* ------------------------------------------------------------------ */

adminAccountRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return fail(c, 400, 'invalid_id', '账号 ID 不合法')
  }

  const session = c.get('session')
  if (id === Number(session.sub)) {
    return fail(c, 400, 'cannot_delete_self', '不能删除自己的账号')
  }

  const db = getDb()
  const rows = await db.select().from(admins).where(eq(admins.id, id)).limit(1)
  const target = rows[0]
  if (!target) return fail(c, 404, 'not_found', '账号不存在')

  if (normalizeRole(target.role, 'owner') === 'owner') {
    const remaining = await countActiveOwners(id)
    if (remaining === 0) {
      return fail(c, 400, 'last_owner', '至少要保留一个超级管理员，不能删除最后一个')
    }
  }

  await db.delete(admins).where(eq(admins.id, id))
  return ok(c, { ok: true })
})

/* ------------------------------------------------------------------ */
/* 重置初始密码状态                                                    */
/* ------------------------------------------------------------------ */

/**
 * 让某个账号下次登录强制改密。
 * 比直接改密码温和，适合「怀疑密码已外泄」的场景。
 */
adminAccountRoutes.post('/:id/force-password-change', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return fail(c, 400, 'invalid_id', '账号 ID 不合法')
  }

  const db = getDb()
  const updated = await db
    .update(admins)
    .set({ mustChangePassword: true, updatedAt: new Date() })
    .where(eq(admins.id, id))
    .returning()

  const row = updated[0]
  if (!row) return fail(c, 404, 'not_found', '账号不存在')
  return ok(c, toAccount(row))
})
