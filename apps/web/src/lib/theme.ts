/**
 * 主题应用 — 把后端返回的主题配置写到 :root 的 CSS 变量上。
 *
 * 为什么不用内联 style 写死颜色：Tailwind 的 @theme 已经把这些变量映射成
 * 工具类（bg-primary、text-muted 等），只要改变量值，整站视觉立刻切换，
 * 无需重新构建。管理员在后台改一处，前台所有用到该颜色的地方同步生效。
 */

import type { ColorMode, SiteSettings, ThemeSettings } from '@school/shared'
import { CONTAINER_PX, FONT_STACK, RADIUS_PX } from '@school/shared'

export function resolveColorMode(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }
  return mode
}

/** 把主题写入 CSS 变量并切换 html.dark */
export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement

  root.style.setProperty('--c-primary', theme.primary)
  root.style.setProperty('--c-primary-fg', theme.primaryForeground)
  root.style.setProperty('--c-accent', theme.accent)
  root.style.setProperty('--c-bg', theme.background)
  root.style.setProperty('--c-surface', theme.surface)
  root.style.setProperty('--c-fg', theme.foreground)
  root.style.setProperty('--c-muted', theme.muted)
  root.style.setProperty('--c-border', theme.border)
  root.style.setProperty('--c-radius', RADIUS_PX[theme.radius])
  root.style.setProperty('--c-font', FONT_STACK[theme.fontFamily])
  root.style.setProperty('--c-container', CONTAINER_PX[theme.containerWidth])

  const mode = resolveColorMode(theme.colorMode)
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.colorMode = theme.colorMode
}

/** 把站点基础信息（标题、描述、favicon）同步到 document */
export function applySiteMeta(settings: SiteSettings): void {
  document.title = settings.siteName

  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute(attr, key)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  setMeta('name', 'description', settings.siteDescription)
  setMeta('property', 'og:title', settings.siteName)
  setMeta('property', 'og:description', settings.siteDescription)
  setMeta('property', 'og:type', 'website')

  if (settings.faviconUrl) {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = settings.faviconUrl
  }
}

/** 监听系统深浅色变化，仅在 colorMode === 'auto' 时生效 */
export function watchSystemColorMode(theme: ThemeSettings, onChange: () => void): () => void {
  if (theme.colorMode !== 'auto' || !window.matchMedia) return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    applyTheme(theme)
    onChange()
  }
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}
