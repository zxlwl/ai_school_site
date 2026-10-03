/**
 * 站点设置服务 — 读写 settings 表中的单行 JSON，并与默认值深合并。
 *
 * 深合并的意义：将来 DEFAULT_SETTINGS 新增字段时，老库中已有的 JSON
 * 不会因缺字段而让前端拿到 undefined，无需写数据库迁移脚本。
 */

import { eq } from 'drizzle-orm'
import { DEFAULT_SETTINGS, THEME_PRESETS, type SiteSettings } from '@school/shared'
import { getDb } from '../db/client'
import { settings } from '../db/schema'

const SETTINGS_KEY = 'site'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K]
}

/** 递归合并，数组整体替换而非逐项合并 */
function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base
  if (Array.isArray(base) || Array.isArray(patch)) return patch as T
  if (typeof base !== 'object' || typeof patch !== 'object') return patch as T

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = (base as Record<string, unknown>)[key]
    result[key] =
      current && typeof current === 'object' && !Array.isArray(current)
        ? deepMerge(current, value)
        : value
  }
  return result as T
}

/**
 * 校验并规范化设置对象，丢弃非法值，避免后台填入的脏数据破坏前台渲染。
 */
function sanitize(input: SiteSettings): SiteSettings {
  const hex = /^#[0-9a-fA-F]{3,8}$/
  const color = (value: unknown, fallback: string): string =>
    typeof value === 'string' && hex.test(value.trim()) ? value.trim() : fallback

  const merged = deepMerge(DEFAULT_SETTINGS, input)
  const theme = merged.theme

  return {
    ...merged,
    siteName: String(merged.siteName || DEFAULT_SETTINGS.siteName).slice(0, 100),
    siteTagline: String(merged.siteTagline ?? '').slice(0, 200),
    siteDescription: String(merged.siteDescription ?? '').slice(0, 500),
    logoText: String(merged.logoText ?? '').slice(0, 20),
    featuredCount: Math.min(12, Math.max(1, Number(merged.featuredCount) || 3)),
    socialLinks: (Array.isArray(merged.socialLinks) ? merged.socialLinks : [])
      .filter((item) => item && typeof item.url === 'string' && item.url.trim())
      .slice(0, 8)
      .map((item) => ({
        label: String(item.label ?? '').slice(0, 40),
        url: String(item.url).slice(0, 500),
        icon: String(item.icon ?? 'link').slice(0, 40),
      })),
    theme: {
      ...theme,
      // 预设 ID 必须是已知值，否则回退默认
      preset: THEME_PRESETS.some((p) => p.id === theme.preset)
        ? theme.preset
        : DEFAULT_SETTINGS.theme.preset,
      primary: color(theme.primary, DEFAULT_SETTINGS.theme.primary),
      primaryForeground: color(theme.primaryForeground, DEFAULT_SETTINGS.theme.primaryForeground),
      accent: color(theme.accent, DEFAULT_SETTINGS.theme.accent),
      background: color(theme.background, DEFAULT_SETTINGS.theme.background),
      surface: color(theme.surface, DEFAULT_SETTINGS.theme.surface),
      foreground: color(theme.foreground, DEFAULT_SETTINGS.theme.foreground),
      muted: color(theme.muted, DEFAULT_SETTINGS.theme.muted),
      border: color(theme.border, DEFAULT_SETTINGS.theme.border),
      radius: (['none', 'small', 'medium', 'large'] as const).includes(theme.radius)
        ? theme.radius
        : DEFAULT_SETTINGS.theme.radius,
      fontFamily: (['system', 'sans', 'serif', 'mono'] as const).includes(theme.fontFamily)
        ? theme.fontFamily
        : DEFAULT_SETTINGS.theme.fontFamily,
      containerWidth: (['narrow', 'normal', 'wide'] as const).includes(theme.containerWidth)
        ? theme.containerWidth
        : DEFAULT_SETTINGS.theme.containerWidth,
      colorMode: (['light', 'dark', 'auto'] as const).includes(theme.colorMode)
        ? theme.colorMode
        : DEFAULT_SETTINGS.theme.colorMode,
    },
  }
}

/** 读取站点设置；表为空时返回默认值（不写库） */
export async function getSettings(): Promise<SiteSettings> {
  const db = getDb()
  const rows = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1)
  if (rows.length === 0) return DEFAULT_SETTINGS
  return sanitize(deepMerge(DEFAULT_SETTINGS, rows[0].value as DeepPartial<SiteSettings>))
}

/** 局部更新站点设置，返回合并后的完整设置 */
export async function updateSettings(patch: DeepPartial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()
  const next = sanitize(deepMerge(current, patch))

  const db = getDb()
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: next })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: next, updatedAt: new Date() },
    })

  return next
}
