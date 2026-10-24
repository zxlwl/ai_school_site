/**
 * 认证工具 — 密码哈希、JWT 签发与校验、Cookie 读写。
 *
 * 设计要点：
 * - 密码用 bcrypt 哈希存储，永不落库明文。
 * - 会话用 JWT 存放在 httpOnly Cookie 中，前端 JS 读不到，天然防 XSS 窃取。
 * - jose 是纯 WebCrypto 实现，Node 与 Cloudflare Workers 均可运行。
 * - bcryptjs 为纯 JS 实现，同样跨运行时（Workers 无原生 bcrypt 模块）。
 *
 * ── 两套会话互不干扰 ──────────────────────────────────────────────
 * 管理员（后台）与会员（前台）用**不同的 Cookie 名**和**不同的 JWT
 * audience**：
 *   school_session   → 管理员，aud = 'admin'
 *   school_user      → 会员，  aud = 'user'
 *
 * 这样会员令牌绝不可能被当成管理员令牌使用（即使签名密钥相同）。
 * 共用一套是最常见的越权漏洞来源，这里从设计上排除。
 */

import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { AdminRole, UserRole } from '@school/shared'

const ADMIN_COOKIE = 'school_session'
const USER_COOKIE = 'school_user'

const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 天
const USER_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 天

/** 初始管理员账号（仅首次初始化时写入，之后改库即可） */
export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'admin123'

export interface SessionPayload {
  sub: string
  username: string
  /** 是否仍需修改初始密码 */
  mcp: boolean
  /** 当前账号角色，用于权限判定 */
  role: AdminRole
}

export interface UserSessionPayload {
  sub: string
  username: string
  role: UserRole
}

/* ------------------------------------------------------------------ */
/* 密码                                                                */
/* ------------------------------------------------------------------ */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* JWT                                                                 */
/* ------------------------------------------------------------------ */

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET 未配置或过短（至少 16 字符）。请设置一个随机字符串，例如 `openssl rand -base64 32` 的输出。',
    )
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, mcp: payload.mcp, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setAudience('admin')
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    // audience 校验是硬隔离：会员令牌在这里一定失败
    const { payload } = await jwtVerify(token, getSecret(), { audience: 'admin' })
    if (!payload.sub) return null
    const role = (payload.role as AdminRole) ?? 'owner'
    return {
      sub: payload.sub,
      username: String(payload.username ?? ''),
      mcp: Boolean(payload.mcp),
      role: role === 'owner' || role === 'editor' || role === 'viewer' ? role : 'viewer',
    }
  } catch {
    return null
  }
}

export async function signUserSession(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setAudience('user')
    .setIssuedAt()
    .setExpirationTime(`${USER_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyUserSession(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: 'user' })
    if (!payload.sub) return null
    return {
      sub: payload.sub,
      username: String(payload.username ?? ''),
      role: payload.role === 'moderator' ? 'moderator' : 'member',
    }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Cookie                                                              */
/* ------------------------------------------------------------------ */

/**
 * 读取请求 Cookie 中的会话令牌。不依赖框架的 cookie helper，
 * 这样在 Node 与 Workers 下行为完全一致。
 */
function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return null
}

function buildCookie(
  name: string,
  token: string,
  secure: boolean,
  maxAge: number,
): string {
  const attrs = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (secure) attrs.push('Secure')
  return attrs.join('; ')
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/* ---------------------------- 管理员 ------------------------------ */

export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  return readCookie(cookieHeader, ADMIN_COOKIE)
}

/**
 * 生成 Set-Cookie 头。
 * @param secure 生产环境启用 Secure；本地 http 调试需关闭，否则浏览器不保存
 */
export function buildSessionCookie(token: string, secure: boolean): string {
  return buildCookie(ADMIN_COOKIE, token, secure, ADMIN_TTL_SECONDS)
}

export function buildClearCookie(): string {
  return clearCookie(ADMIN_COOKIE)
}

/* ----------------------------- 会员 ------------------------------- */

export function readUserCookie(cookieHeader: string | null | undefined): string | null {
  return readCookie(cookieHeader, USER_COOKIE)
}

export function buildUserCookie(token: string, secure: boolean): string {
  return buildCookie(USER_COOKIE, token, secure, USER_TTL_SECONDS)
}

export function buildClearUserCookie(): string {
  return clearCookie(USER_COOKIE)
}

/**
 * 一次请求可能需要同时下发两个 Set-Cookie（例如退出时清理两种会话）。
 * Hono 的 c.header 会覆盖同名头，所以多值场景要用 append。
 */
export { ADMIN_COOKIE, USER_COOKIE }
