/**
 * 账号管理 — 仅超级管理员可见。
 *
 * 列表 + 新建 + 编辑 + 删除 + 强制改密。
 * 防自锁规则（不能停用自己、不能降级自己、不能删掉最后一个 owner）
 * 由服务端强制，这里只负责把错误信息显示出来 —— 前端隐藏按钮只是体验。
 */

import { useEffect, useState } from 'react'
import {
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserX,
} from 'lucide-react'
import type { AdminAccount, AdminRole } from '@school/shared'
import { ADMIN_ROLES, ADMIN_ROLE_LABEL } from '@school/shared'
import { ApiError, adminAccountApi, authApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Skeleton,
  Spinner,
  toast,
} from '../../components/ui'

interface FormState {
  username: string
  displayName: string
  role: AdminRole
  active: boolean
  password: string
}

const EMPTY: FormState = {
  username: '',
  displayName: '',
  role: 'editor',
  active: true,
  password: '',
}

export default function AdminAccounts() {
  const { data, loading, error, reload } = useAsync<AdminAccount[]>(
    () => adminAccountApi.list(),
    [],
  )

  const [me, setMe] = useState<{ username?: string }>({})
  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AdminAccount | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 拿到自己的用户名，用来把「当前账号」标出来并禁用危险按钮
  useEffect(() => {
    let cancelled = false
    authApi
      .session()
      .then((session) => {
        if (!cancelled) setMe({ username: session?.username })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const selfName = me.username

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (account: AdminAccount) => {
    setEditing(account)
    setForm({
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      active: account.active,
      password: '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setFormError('')

    if (!editing) {
      if (!form.username.trim()) {
        setFormError('请填写用户名')
        return
      }
      if (!form.password) {
        setFormError('请设置初始密码')
        return
      }
    } else if (form.password && form.password.length < 8) {
      setFormError('密码至少需要 8 位')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await adminAccountApi.update(editing.id, {
          displayName: form.displayName.trim() || undefined,
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        })
        toast.success('账号已更新')
      } else {
        await adminAccountApi.create({
          username: form.username.trim(),
          displayName: form.displayName.trim() || undefined,
          role: form.role,
          active: form.active,
          password: form.password,
        })
        toast.success('账号已创建')
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await adminAccountApi.remove(confirmDelete.id)
      toast.success('账号已删除')
      setConfirmDelete(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleForceChange = async (account: AdminAccount) => {
    try {
      await adminAccountApi.forcePasswordChange(account.id)
      toast.success(`已要求「${account.username}」下次登录时修改密码`)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">账号管理</h1>
          <p className="mt-1 text-sm text-muted">
            管理后台登录账号与权限。只有超级管理员可以进入此页。
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={15} aria-hidden />
          新建账号
        </button>
      </header>

      {/* 角色说明：把权限模型直接写出来，避免靠猜 */}
      <div className="card-theme mt-5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={15} className="text-primary" aria-hidden />
          角色权限说明
        </p>
        <ul className="mt-2.5 grid gap-1.5 text-xs text-muted sm:grid-cols-3">
          <li>
            <span className="font-medium text-fg">超级管理员</span>
            ：全部权限，可管理账号
          </li>
          <li>
            <span className="font-medium text-fg">编辑</span>
            ：可增删改文章、分类、公告、单页
          </li>
          <li>
            <span className="font-medium text-fg">只读</span>
            ：仅可查看后台数据，不能修改
          </li>
        </ul>
      </div>

      <div className="card-theme mt-4 overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="还没有账号" description="创建一个管理员账号开始管理内容。" />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((account) => {
              const isSelf = selfName === account.username
              return (
                <li key={account.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-theme"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--c-primary) 12%, transparent)',
                      color: 'var(--c-primary)',
                    }}
                    aria-hidden
                  >
                    <UserCog size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {account.displayName}
                      <span className="font-mono text-xs text-muted">@{account.username}</span>
                      {isSelf && (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
                          当前账号
                        </span>
                      )}
                      {!account.active && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                          <UserX size={10} aria-hidden />
                          已停用
                        </span>
                      )}
                      {account.mustChangePassword && (
                        <span className="rounded-full bg-amber-500/14 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          待改密
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{ADMIN_ROLE_LABEL[account.role]}</span>
                      <span>·</span>
                      <span>
                        {account.lastLoginAt
                          ? `最近登录 ${new Date(account.lastLoginAt).toLocaleString('zh-CN')}`
                          : '从未登录'}
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleForceChange(account)}
                      className="rounded p-2 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                      aria-label={`要求 ${account.username} 改密`}
                      title="要求下次登录时修改密码"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(account)}
                      className="rounded p-2 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                      aria-label={`编辑 ${account.username}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(account)}
                      disabled={isSelf}
                      className="rounded p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`删除 ${account.username}`}
                      title={isSelf ? '不能删除自己的账号' : '删除账号'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `编辑账号：${editing.username}` : '新建管理员账号'}
        onClose={() => setModalOpen(false)}
        width="max-w-lg"
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              取消
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Spinner />}
              {editing ? '保存修改' : '创建'}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          {!editing && (
            <Field label="用户名" required hint="3-32 位字母、数字或下划线，登录时使用">
              <input
                className="input-theme font-mono"
                value={form.username}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                  setFormError('')
                }}
                placeholder="zhangsan"
                maxLength={32}
                autoFocus
              />
            </Field>
          )}

          <Field label="显示名" hint="后台顶部显示的名字">
            <input
              className="input-theme"
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder="张老师"
              maxLength={64}
            />
          </Field>

          <Field label="角色">
            <select
              className="input-theme"
              value={form.role}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, role: event.target.value as AdminRole }))
              }
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ADMIN_ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={editing ? '重置密码' : '初始密码'}
            required={!editing}
            hint={editing ? '留空表示不修改密码' : '至少 8 位，首次登录后会被要求修改'}
          >
            <input
              type="password"
              className="input-theme"
              value={form.password}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, password: event.target.value }))
                setFormError('')
              }}
              placeholder={editing ? '不修改请留空' : '至少 8 位'}
              autoComplete="new-password"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            启用该账号（取消勾选后无法登录）
          </label>

          {formError && (
            <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="删除账号"
        message={`确定要删除账号「${confirmDelete?.username ?? ''}」吗？删除后该账号将无法登录，且此操作不可撤销。如果只是想暂时禁止登录，建议改为「停用」。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
