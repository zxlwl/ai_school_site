/**
 * 会员登录页（前台）。
 *
 * 与后台 /admin/login 完全独立：用的是 /api/account/* 和 school_user Cookie。
 * 登录成功后回到来源页（?redirect=），默认回首页。
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { accountApi } from '../lib/api'
import { ApiError } from '../lib/api'
import { Field, Spinner, toast } from '../components/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/'

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 已登录就直接跳走，避免重复登录
  useEffect(() => {
    let cancelled = false
    accountApi
      .session()
      .then((session) => {
        if (!cancelled && session?.authenticated) navigate(redirect, { replace: true })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [navigate, redirect])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!account.trim() || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    try {
      await accountApi.login({ account: account.trim(), password })
      toast.success('登录成功')
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-theme"
          style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
          aria-hidden
        >
          <LogIn size={22} />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">会员登录</h1>
        <p className="mt-1.5 text-sm text-muted">登录后可以参与讨论、管理个人资料</p>
      </div>

      <form onSubmit={handleSubmit} className="card-theme mt-6 grid gap-4 p-6">
        <Field label="用户名或邮箱" required>
          <input
            className="input-theme"
            value={account}
            onChange={(event) => {
              setAccount(event.target.value)
              setError('')
            }}
            placeholder="用户名或邮箱"
            autoComplete="username"
            autoFocus
          />
        </Field>

        <Field label="密码" required>
          <input
            type="password"
            className="input-theme"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </Field>

        {error && (
          <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary justify-center" disabled={loading}>
          {loading && <Spinner />}
          登录
        </button>

        <p className="text-center text-sm text-muted">
          还没有账号？
          <Link
            to={`/register${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="ml-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <UserPlus size={13} aria-hidden />
            立即注册
          </Link>
        </p>
      </form>
    </div>
  )
}
