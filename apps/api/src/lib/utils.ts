/**
 * 通用工具：统一响应格式、slug 生成与唯一化、请求解析。
 */

import type { Context } from 'hono'
import { slugify } from '@school/shared'

/* ------------------------------------------------------------------ */
/* 响应                                                                */
/* ------------------------------------------------------------------ */

export function ok<T>(c: Context, data: T, status = 200) {
  return c.json({ data }, status as 200)
}

export function fail(c: Context, status: number, error: string, message: string, details?: unknown) {
  return c.json({ error, message, details }, status as 400)
}

/** 从查询参数解析整数，带范围约束 */
export function parseIntParam(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function parseBoolParam(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return undefined
}

/* ------------------------------------------------------------------ */
/* slug                                                                */
/* ------------------------------------------------------------------ */

/**
 * 由标题生成 slug；中文标题经 slugify 后可能为空，
 * 此时回退为带时间戳的标识，保证唯一且可读。
 */
export function makeSlug(title: string, explicit?: string | null): string {
  const base = slugify(explicit?.trim() || title)
  if (base) return base
  return `item-${Date.now().toString(36)}`
}

/**
 * 确保 slug 在表内唯一：若冲突则追加 -2、-3 …。
 * @param exists 查询函数，返回是否已存在同名 slug（可排除自身 id）
 */
export async function uniqueSlug(
  desired: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(desired))) return desired
  for (let i = 2; i < 200; i++) {
    const candidate = `${desired}-${i}`
    if (!(await exists(candidate))) return candidate
  }
  return `${desired}-${Date.now().toString(36)}`
}

/* ------------------------------------------------------------------ */
/* 时间                                                                */
/* ------------------------------------------------------------------ */

/** 宽松解析日期字符串，非法值返回 null */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

/** 数据库 timestamp 字段 → ISO 字符串（API 输出统一格式） */
export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/* ------------------------------------------------------------------ */
/* 请求体                                                              */
/* ------------------------------------------------------------------ */

/** 安全读取 JSON body，解析失败返回 null 而非抛错 */
export async function readJson<T = unknown>(c: Context): Promise<T | null> {
  try {
    return (await c.req.json()) as T
  } catch {
    return null
  }
}

/** 从请求头推断是否应设置 Secure Cookie */
export function isSecureRequest(c: Context): boolean {
  const url = new URL(c.req.url)
  if (url.protocol === 'https:') return true
  const proto = c.req.header('x-forwarded-proto')
  return proto === 'https'
}
