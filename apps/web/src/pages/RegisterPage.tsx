/**
 * 会员注册页（前台）。
 *
 * 注册成功后后端会直接下发会话 Cookie，因此这里是「注册即登录」，
 * 随后跳转到来源页或首页。
 */

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { ApiError, accountApi } from '../lib/api'
import { Field, Spinner, toast } from '../components/ui'

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/'

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('请填写用户名')
      return
    }
    if (password.length < 8) {
      setError('密码至少需要 8 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await accountApi.register({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        displayName: displayName.trim() || undefined,
      })
      toast.success('注册成功，已自动登录')
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败，请稍后重试')
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
          <UserPlus size={22} />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">注册会员</h1>
        <p className="mt-1.5 text-sm text-muted">创建账号后即可参与讨论、管理个人资料</p>
      </div>

      <form onSubmit={handleSubmit} className="card-theme mt-6 grid gap-4 p-6">
        <Field label="用户名" required hint="3-20 位字母、数字或下划线，注册后不可修改">
          <input
            className="input-theme font-mono"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setError('')
            }}
            placeholder="zhangsan"
            autoComplete="username"
            maxLength={20}
            autoFocus
          />
        </Field>

        <Field label="显示名" hint="留空则与用户名相同">
          <input
            className="input-theme"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="张三"
            maxLength={64}
          />
        </Field>

        <Field label="邮箱" hint="选填，用于找回密码（后续功能）">
          <input
            type="email"
            className="input-theme"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <Field label="密码" required hint="至少 8 位">
          <input
            type="password"
            className="input-theme"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            autoComplete="new-password"
          />
        </Field>

        <Field label="确认密码" required>
          <input
            type="password"
            className="input-theme"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value)
              setError('')
            }}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary justify-center" disabled={loading}>
          {loading && <Spinner />}
          注册并登录
        </button>

        <p className="text-center text-sm text-muted">
          已有账号？
          <Link
            to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="ml-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <LogIn size={13} aria-hidden />
            去登录
          </Link>
        </p>
      </form>
    </div>
  )
}
