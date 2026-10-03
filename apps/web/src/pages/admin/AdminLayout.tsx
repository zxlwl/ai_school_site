/**
 * 后台布局 — 侧边导航 + 顶栏 + 鉴权守卫。
 *
 * 路由守卫逻辑：进入任何 /* 后台页面先请求 /admin/stats 探测会话；
 * 401 则跳转登录页。这样即使有人直接输入 URL 也无法绕过。
 */

import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  FileText,
  FolderTree,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Palette,
  Settings as SettingsIcon,
  ShieldAlert,
  X,
} from 'lucide-react'
import { authApi, UnauthorizedError } from '../../lib/api'
import { useSiteSettings } from '../../lib/hooks'
import { Spinner, ToastHost, cn, toast } from '../../components/ui'

const NAV_ITEMS = [
  { to: '/admin', label: '仪表盘', icon: LayoutDashboard, exact: true },
  { to: '/admin/articles', label: '文章管理', icon: FileText },
  { to: '/admin/categories', label: '分类管理', icon: FolderTree },
  { to: '/admin/announcements', label: '公告管理', icon: Megaphone },
  { to: '/admin/pages', label: '单页管理', icon: ImageIcon },
  { to: '/admin/messages', label: '访客留言', icon: MessageSquare },
  { to: '/admin/appearance', label: '外观主题', icon: Palette },
  { to: '/admin/settings', label: '系统设置', icon: SettingsIcon },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { data: siteSettings } = useSiteSettings()

  const [authState, setAuthState] = useState<'checking' | 'ok' | 'denied' | 'offline'>('checking')
  const [username, setUsername] = useState<string | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // 会话探测：先问 session 拿到权威登录态，再拉 stats 供页面使用。
  // 必须与 AdminLogin 用同一个判据（session.authenticated），否则两边结论不一致
  // 会在 /admin 与 /admin/login 之间来回跳转。
  useEffect(() => {
    let cancelled = false
    authApi
      .session()
      .then((session) => {
        if (cancelled) return
        setUsername(session?.username ?? null)
        setMustChangePassword(session?.mustChangePassword ?? false)
        if (!session?.authenticated) {
          setAuthState('denied')
          navigate('/admin/login', { replace: true })
          return
        }
        setAuthState('ok')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof UnauthorizedError) {
          setAuthState('denied')
          navigate('/admin/login', { replace: true })
        } else {
          // 网络层或服务端故障：停留在此页并提示，不要跳登录页，
          // 否则 API 挂掉时会表现为「登录页 ↔ 后台」无限重定向。
          setAuthState('offline')
        }
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // 即便请求失败，本地也要退出，避免用户被困在后台
    }
    toast.success('已退出登录')
    navigate('/admin/login', { replace: true })
  }

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="text-primary" />
          <p className="text-sm text-muted">正在验证登录状态…</p>
        </div>
      </div>
    )
  }

  if (authState === 'offline') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="text-muted" size={40} />
        <h1 className="text-lg font-semibold">无法连接后端 API</h1>
        <p className="max-w-md text-sm text-muted">
          请确认后端服务已启动（默认 http://localhost:8787），然后刷新本页重试。
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            刷新重试
          </button>
          <Link to="/" className="btn-ghost">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="text-muted" size={40} />
        <h1 className="text-lg font-semibold">未登录或会话已过期</h1>
        <p className="max-w-md text-sm text-muted">
          请重新登录后台。若你确信自己已登录，可能是后端 API 未启动，请检查服务状态。
        </p>
        <div className="flex gap-3">
          <Link to="/admin/login" className="btn-primary">
            前往登录
          </Link>
          <Link to="/" className="btn-ghost">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ---------------------------- 侧边栏 ---------------------------- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">
          {siteSettings?.logoText ? (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-theme text-sm font-bold"
              style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
            >
              {siteSettings.logoText.slice(0, 2)}
            </span>
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-theme"
              style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
            >
              <GraduationCap size={17} />
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">内容管理</p>
            <p className="truncate text-[11px] text-muted">{siteSettings?.siteName ?? '学校官网'}</p>
          </div>
          <button
            type="button"
            className="text-muted lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="后台导航">
          <ul className="grid gap-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-theme px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg/80 hover:bg-[color-mix(in_srgb,var(--c-muted)_10%,transparent)] hover:text-fg',
                    )
                  }
                >
                  <item.icon size={16} aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-border p-3">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-theme px-3 py-2 text-sm text-muted transition-colors hover:text-primary"
          >
            <ExternalLink size={15} aria-hidden />
            查看网站首页
          </Link>
        </div>
      </aside>

      {/* 移动端遮罩 */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* ---------------------------- 主区域 ---------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-md md:px-6">
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-1.5 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="打开菜单"
          >
            <Menu size={18} />
          </button>

          <div className="ml-auto flex items-center gap-3">
            {mustChangePassword && (
              <Link
                to="/admin/settings"
                className="hidden items-center gap-1.5 rounded-theme bg-amber-500/12 px-3 py-1.5 text-xs font-medium text-amber-700 transition-opacity hover:opacity-80 sm:flex dark:text-amber-400"
              >
                <ShieldAlert size={13} aria-hidden />
                仍在使用初始密码，请尽快修改
              </Link>
            )}

            <span className="hidden text-sm text-muted sm:inline">
              {username ? `已登录：${username}` : '已登录'}
            </span>

            <button type="button" onClick={handleLogout} className="btn-ghost !px-3 !py-1.5 text-sm">
              <LogOut size={15} aria-hidden />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <ToastHost />
    </div>
  )
}
