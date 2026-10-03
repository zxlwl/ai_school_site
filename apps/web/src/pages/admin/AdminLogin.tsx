/**
 * 后台登录页。
 *
 * 安全设计：登录只提交密码（可选管理员账号名），后端把会话写入 httpOnly Cookie，
 * 前端拿不到也存不了令牌，从根本上规避 XSS 窃取凭证。
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, GraduationCap, KeyRound, Lock, ShieldCheck, User } from 'lucide-react'
import { ApiError, authApi } from '../../lib/api'
import { useSiteSettings } from '../../lib/hooks'
import { Spinner, toast } from '../../components/ui'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { data: settings } = useSiteSettings()

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showUsername, setShowUsername] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  // 已登录则直接进入后台，避免重复登录。
  // 注意：/auth/session 对未登录用户也返回 200，只是 authenticated 为 false，
  // 因此必须显式判断该字段——只看 Promise 是否 resolve 会导致与 AdminLayout
  // 的鉴权结果不一致，进而在两个页面之间无限跳转。
  useEffect(() => {
    let cancelled = false
    authApi
      .session()
      .then((session) => {
        if (cancelled) return
        if (session?.authenticated) {
          navigate('/admin', { replace: true })
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (!password) {
      setError('请输入管理员密码')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await authApi.login(password, showUsername ? username.trim() : undefined)
      toast.success('登录成功')
      // 仍在用初始密码时提醒一句 —— 这是校园站点最常见的安全隐患
      if (result.mustChangePassword) {
        toast.info('当前仍在使用初始密码，建议尽快到「系统设置」中修改')
      }
      navigate('/admin', { replace: true })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 0
            ? err.message
            : err.status === 429
              ? err.message
              : err.status === 401
                ? '密码错误，请重新输入'
                : err.message
          : '登录失败，请稍后重试'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="text-primary" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 0%, color-mix(in srgb, var(--c-primary) 20%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />

      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={15} aria-hidden />
          返回网站首页
        </Link>

        <div className="card-theme p-7 shadow-xl">
          <div className="flex flex-col items-center text-center">
            {settings?.logoText ? (
              <span
                className="flex h-12 w-12 items-center justify-center rounded-theme text-lg font-bold"
                style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
              >
                {settings.logoText.slice(0, 2)}
              </span>
            ) : (
              <span
                className="flex h-12 w-12 items-center justify-center rounded-theme"
                style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
              >
                <GraduationCap size={26} />
              </span>
            )}
            <h1 className="mt-4 text-lg font-semibold">管理后台</h1>
            <p className="mt-1 text-sm text-muted">{settings?.siteName ?? '学校官网'} · 内容管理系统</p>
          </div>

          <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
            {showUsername && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">管理员账号</span>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    className="input-theme !pl-9"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    maxLength={64}
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">管理员密码</span>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="password"
                  className="input-theme !pl-9"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
            </label>

            {error && (
              <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary mt-1 w-full !py-2.5" disabled={submitting}>
              {submitting ? <Spinner /> : <KeyRound size={15} aria-hidden />}
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowUsername((value) => !value)}
            className="mt-4 w-full text-center text-xs text-muted transition-colors hover:text-primary"
          >
            {showUsername ? '使用默认管理员账号登录' : '使用其他管理员账号'}
          </button>
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <span>
            默认密码为 <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">admin123</code>，
            首次登录后请立即在「系统设置」中修改。会话保存在 httpOnly Cookie 中，前端无法读取。
          </span>
        </p>
      </div>
    </div>
  )
}
