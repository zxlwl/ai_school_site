/**
 * 会员账号中心（前台）。
 *
 * 未登录时显示引导登录；已登录可修改显示名 / 邮箱 / 头像，以及改密码。
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, LogOut, Mail, ShieldCheck, User as UserIcon } from 'lucide-react'
import type { UserProfile } from '@school/shared'
import { USER_STATUS_LABEL } from '@school/shared'
import { ApiError, accountApi } from '../lib/api'
import { Field, Spinner, toast } from '../components/ui'

export function AccountPage() {
  const navigate = useNavigate()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changing, setChanging] = useState(false)

  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    accountApi
      .session()
      .then((session) => {
        if (cancelled) return
        if (session?.authenticated && session.user) {
          setUser(session.user)
          setDisplayName(session.user.displayName)
          setEmail(session.user.email ?? '')
        } else {
          setUser(null)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const result = await accountApi.updateProfile({
        displayName: displayName.trim(),
        email: email.trim(),
      })
      setUser(result.user)
      toast.success('资料已保存')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('新密码至少需要 8 位')
      return
    }
    setChanging(true)
    try {
      await accountApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      toast.success('密码已更新')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改失败')
    } finally {
      setChanging(false)
    }
  }

  const handleLogout = async () => {
    try {
      await accountApi.logout()
    } catch {
      // 请求失败也要让用户能离开
    }
    toast.success('已退出登录')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-24">
        <Spinner className="text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <UserIcon size={36} className="text-muted" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">你还没有登录</h1>
        <p className="mt-1.5 text-sm text-muted">登录后可管理个人资料</p>
        <div className="mt-5 flex gap-3">
          <Link to="/login?redirect=/account" className="btn-primary">
            去登录
          </Link>
          <Link to="/register" className="btn-ghost">
            注册账号
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">账号中心</h1>
          <p className="mt-1 text-sm text-muted">管理你的个人资料与登录密码</p>
        </div>
        <button type="button" className="btn-ghost" onClick={handleLogout}>
          <LogOut size={15} aria-hidden />
          退出登录
        </button>
      </header>

      {/* 账号概览 */}
      <div className="card-theme mt-5 p-5">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold"
              style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
              aria-hidden
            >
              {user.displayName.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {user.displayName}
              {user.status !== 'active' && (
                <span className="rounded-full bg-amber-500/14 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  {USER_STATUS_LABEL[user.status]}
                </span>
              )}
            </p>
            <p className="font-mono text-xs text-muted">@{user.username}</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted">
            <Mail size={14} aria-hidden />
            <span className="truncate">{user.email || '未填写邮箱'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <CalendarDays size={14} aria-hidden />
            <span>注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
        </dl>
      </div>

      {/* 修改资料 */}
      <form onSubmit={handleSaveProfile} className="card-theme mt-4 grid gap-4 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <UserIcon size={16} className="text-primary" aria-hidden />
          个人资料
        </h2>

        <Field label="显示名">
          <input
            className="input-theme"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={64}
          />
        </Field>

        <Field label="邮箱" hint="选填">
          <input
            type="email"
            className="input-theme"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        {error && (
          <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <Spinner />}
            保存资料
          </button>
        </div>
      </form>

      {/* 修改密码 */}
      <form onSubmit={handleChangePassword} className="card-theme mt-4 grid gap-4 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck size={16} className="text-primary" aria-hidden />
          修改密码
        </h2>

        <Field label="当前密码" required>
          <input
            type="password"
            className="input-theme"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <Field label="新密码" required hint="至少 8 位">
          <input
            type="password"
            className="input-theme"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <div>
          <button type="submit" className="btn-primary" disabled={changing}>
            {changing && <Spinner />}
            更新密码
          </button>
        </div>
      </form>
    </div>
  )
}
