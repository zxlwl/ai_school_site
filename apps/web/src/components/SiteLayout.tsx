/**
 * 全站布局：页头 + 页脚。
 *
 * 导航结构（首页 / 文章分类 / 单页 / 公告）全部由后端驱动，
 * 管理员新建一个分类或单页，导航栏会自动出现对应入口。
 */

import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { GraduationCap, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import type { Category, Page, SiteSettings } from '@school/shared'
import { useAsync, useSiteSettings } from '../lib/hooks'
import { publicApi } from '../lib/api'
import { cn, ToastHost } from './ui'

interface NavData {
  categories: Category[]
  pages: Array<Pick<Page, 'id' | 'title' | 'slug' | 'sortOrder'>>
  siteName: string
}

export function SiteLayout() {
  const { data: settings, loading } = useSiteSettings()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const { data: nav } = useAsync<NavData>(() => publicApi.navigation(), [])

  // 路由变化时收起移动端菜单并回到顶部
  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  // 滚动时给页头加阴影，让页面层级更清晰
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading && !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <GraduationCap className="animate-pulse text-primary" size={40} />
          <p className="text-sm text-muted">正在加载…</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <GraduationCap className="text-muted" size={40} />
        <h1 className="text-lg font-semibold">无法加载站点</h1>
        <p className="max-w-md text-sm text-muted">
          前端已启动，但没能连接到后端 API。请确认 API 服务正在运行，
          并且 <code className="rounded bg-black/5 px-1.5 py-0.5">VITE_API_BASE</code> 指向了正确的地址。
        </p>
        <Link to="/admin" className="btn-primary mt-2">
          进入后台
        </Link>
      </div>
    )
  }

  const categories = nav?.categories ?? []
  const pages = nav?.pages ?? []
  const base = location.pathname.startsWith('/admin') ? '/admin' : '/'

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={cn(
          'sticky top-0 z-40 border-b bg-surface/85 backdrop-blur-md transition-shadow',
          scrolled ? 'border-border shadow-sm' : 'border-transparent',
        )}
      >
        <div className="container-theme flex h-16 items-center gap-4">
          {/* 校徽 + 校名 */}
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label={`${settings.siteName} 首页`}>
            {settings.faviconUrl ? (
              <img src={settings.faviconUrl} alt="" className="h-9 w-9 rounded object-contain" />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-theme"
                style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
              >
                {settings.logoText ? (
                  <span className="text-sm font-semibold">{settings.logoText}</span>
                ) : (
                  <GraduationCap size={20} />
                )}
              </span>
            )}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[15px] font-semibold tracking-tight">{settings.siteName}</span>
              {settings.siteTagline && (
                <span className="hidden truncate text-[11px] text-muted sm:block">{settings.siteTagline}</span>
              )}
            </span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="ml-auto hidden min-w-0 items-center gap-0.5 lg:flex" aria-label="主导航">
            <NavItem to="/" exact>
              首页
            </NavItem>
            <NavItem to="/articles">全部文章</NavItem>
            <NavItem to="/announcements">通知公告</NavItem>
            {categories.slice(0, 3).map((category) => (
              <NavItem key={category.id} to={`/category/${category.slug}`}>
                {category.name}
              </NavItem>
            ))}
            {pages.slice(0, 2).map((page) => (
              <NavItem key={page.id} to={`/${page.slug}`}>
                {page.title}
              </NavItem>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link to="/admin" className="btn-ghost hidden !px-3 !py-1.5 text-sm sm:inline-flex">
              管理后台
            </Link>
            <button
              type="button"
              className="btn-ghost !px-2.5 !py-1.5 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* 移动端导航抽屉 */}
        {menuOpen && (
          <nav className="border-t border-border lg:hidden animate-fade-in" aria-label="移动端导航">
            <div className="container-theme grid gap-0.5 py-3">
              <MobileNavItem to="/" exact>
                首页
              </MobileNavItem>
              <MobileNavItem to="/articles">全部文章</MobileNavItem>
              <MobileNavItem to="/announcements">通知公告</MobileNavItem>
              {categories.map((category) => (
                <MobileNavItem key={category.id} to={`/category/${category.slug}`}>
                  {category.name}
                </MobileNavItem>
              ))}
              {pages.map((page) => (
                <MobileNavItem key={page.id} to={`/${page.slug}`}>
                  {page.title}
                </MobileNavItem>
              ))}
              <MobileNavItem to="/admin">管理后台</MobileNavItem>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <SiteFooter settings={settings} categories={categories} pages={pages} />
      <ToastHost />
      {/* base 变量保留：后台布局共用同一份页脚样式时可用 */}
      <span className="hidden" aria-hidden data-base={base} />
    </div>
  )
}

function NavItem({ to, exact, children }: { to: string; exact?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          'shrink-0 whitespace-nowrap rounded-theme px-2.5 py-1.5 text-[13px] font-medium transition-colors',
          isActive ? 'text-primary' : 'text-fg/75 hover:bg-[color-mix(in_srgb,var(--c-muted)_10%,transparent)] hover:text-fg',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function MobileNavItem({ to, exact, children }: { to: string; exact?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          'rounded-theme px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-[color-mix(in_srgb,var(--c-muted)_10%,transparent)]',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function SiteFooter({
  settings,
  categories,
  pages,
}: {
  settings: SiteSettings
  categories: Category[]
  pages: Array<Pick<Page, 'id' | 'title' | 'slug'>>
}) {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-theme grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        {/* 学校简介 */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            {settings.faviconUrl ? (
              <img src={settings.faviconUrl} alt="" className="h-9 w-9 rounded object-contain" />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-theme"
                style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
              >
                {settings.logoText ? (
                  <span className="text-sm font-semibold">{settings.logoText}</span>
                ) : (
                  <GraduationCap size={20} />
                )}
              </span>
            )}
            <span className="font-semibold">{settings.siteName}</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{settings.siteDescription}</p>

          {settings.socialLinks.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {settings.socialLinks.map((link) => (
                <a
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge-theme border border-border text-muted transition-colors hover:border-primary hover:text-primary"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 快速导航 */}
        <div>
          <h2 className="text-sm font-semibold">快速导航</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/articles" className="text-muted transition-colors hover:text-primary">
                全部文章
              </Link>
            </li>
            <li>
              <Link to="/announcements" className="text-muted transition-colors hover:text-primary">
                通知公告
              </Link>
            </li>
            {categories.slice(0, 4).map((category) => (
              <li key={category.id}>
                <Link to={`/category/${category.slug}`} className="text-muted transition-colors hover:text-primary">
                  {category.name}
                </Link>
              </li>
            ))}
            {pages.slice(0, 3).map((page) => (
              <li key={page.id}>
                <Link to={`/${page.slug}`} className="text-muted transition-colors hover:text-primary">
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 联系方式 */}
        <div>
          <h2 className="text-sm font-semibold">联系我们</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {settings.contactAddress && (
              <li className="flex gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span>{settings.contactAddress}</span>
              </li>
            )}
            {settings.contactPhone && (
              <li className="flex gap-2.5">
                <Phone size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <a href={`tel:${settings.contactPhone}`} className="transition-colors hover:text-primary">
                  {settings.contactPhone}
                </a>
              </li>
            )}
            {settings.contactEmail && (
              <li className="flex gap-2.5">
                <Mail size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <a href={`mailto:${settings.contactEmail}`} className="transition-colors hover:text-primary">
                  {settings.contactEmail}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-theme flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted sm:flex-row">
          <p>{settings.footerText || `© ${year} ${settings.siteName}. 保留所有权利.`}</p>
          {settings.icpBeian && <p>{settings.icpBeian}</p>}
        </div>
      </div>
    </footer>
  )
}
