/**
 * 认证工具 — 密码哈希、JWT 签发与校验、Cookie 读写。
 *
 * 设计要点：
 * - 密码用 bcrypt 哈希存储，永不落库明文。
 * - 会话用 JWT 存放在 httpOnly Cookie 中，前端 JS 读不到，天然防 XSS 窃取。
 * - jose 是纯 WebCrypto 实现，Node 与 Cloudflare Workers 均可运行。
 * - bcryptjs 为纯 JS 实现，同样跨运行时（Workers 无原生 bcrypt 模块）。
 */

import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'school_session'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 天

/** 初始管理员账号（仅首次初始化时写入，之后改库即可） */
export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'admin123'

export interface SessionPayload {
  sub: string
  username: string
  /** 是否仍需修改初始密码 */
  mcp: boolean
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
  return new SignJWT({ username: payload.username, mcp: payload.mcp })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub) return null
    return {
      sub: payload.sub,
      username: String(payload.username ?? ''),
      mcp: Boolean(payload.mcp),
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
export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key === COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return null
}

/**
 * 生成 Set-Cookie 头。
 * @param secure 生产环境启用 Secure；本地 http 调试需关闭，否则浏览器不保存
 */
export function buildSessionCookie(token: string, secure: boolean): string {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ]
  if (secure) attrs.push('Secure')
  return attrs.join('; ')
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export { COOKIE_NAME }
