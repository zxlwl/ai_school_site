/**
 * 公告管理 — 发布简短通知，支持重要程度与有效期。
 */

import { useState } from 'react'
import { AlertTriangle, Bell, Info, Pencil, Pin, Plus, Power, Trash2 } from 'lucide-react'
import type { Announcement } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { ApiError, adminApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Skeleton,
  Spinner,
  cn,
  toast,
} from '../../components/ui'

interface FormState {
  title: string
  content: string
  level: Announcement['level']
  pinned: boolean
  status: Announcement['status']
  startsAt: string
  endsAt: string
}

const EMPTY: FormState = {
  title: '',
  content: '',
  level: 'info',
  pinned: false,
  status: 'published',
  startsAt: '',
  endsAt: '',
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const LEVEL_META: Record<Announcement['level'], { label: string; icon: typeof Info; className: string }> = {
  info: { label: '普通通知', icon: Info, className: 'text-primary bg-primary/10' },
  important: { label: '重要', icon: Bell, className: 'text-amber-600 bg-amber-500/12 dark:text-amber-400' },
  urgent: { label: '紧急', icon: AlertTriangle, className: 'text-red-600 bg-red-500/12 dark:text-red-400' },
}

export default function AdminAnnouncements() {
  const { data, loading, error, reload } = useAsync<Announcement[]>(() => adminApi.announcements(), [])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (item: Announcement) => {
    setEditing(item)
    setForm({
      title: item.title,
      content: item.content ?? '',
      level: item.level,
      pinned: item.pinned,
      status: item.status,
      startsAt: toLocalInput(item.startsAt),
      endsAt: toLocalInput(item.endsAt),
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('请填写公告标题')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        level: form.level,
        pinned: form.pinned,
        status: form.status,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }
      if (editing) {
        await adminApi.updateAnnouncement(editing.id, payload)
        toast.success('公告已更新')
      } else {
        await adminApi.createAnnouncement(payload)
        toast.success('公告已发布')
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
      await adminApi.deleteAnnouncement(confirmDelete.id)
      toast.success('公告已删除')
      setConfirmDelete(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  /** 快捷开关：置顶与发布状态 */
  const togglePinned = async (item: Announcement) => {
    try {
      await adminApi.updateAnnouncement(item.id, { pinned: !item.pinned })
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败')
    }
  }

  const toggleStatus = async (item: Announcement) => {
    try {
      await adminApi.updateAnnouncement(item.id, {
        status: item.status === 'published' ? 'draft' : 'published',
      })
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败')
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">公告管理</h1>
          <p className="mt-1 text-sm text-muted">公告会显示在首页顶部与公告页，用于发布时效性信息</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={15} aria-hidden />
          发布公告
        </button>
      </header>

      <div className="mt-5 grid gap-3">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : !data || data.length === 0 ? (
          <div className="card-theme">
            <EmptyState
              title="还没有公告"
              description="发布一条公告，让全校师生第一时间知道重要消息。"
              action={
                <button type="button" className="btn-primary mt-1" onClick={openCreate}>
                  发布公告
                </button>
              }
            />
          </div>
        ) : (
          data.map((item) => {
            const meta = LEVEL_META[item.level]
            const Icon = meta.icon
            const expired = item.endsAt && new Date(item.endsAt) < new Date()

            return (
              <article
                key={item.id}
                className={cn('card-theme p-4', (item.status !== 'published' || expired) && 'opacity-60')}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-theme', meta.className)}
                    aria-hidden
                  >
                    <Icon size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{item.title}</h2>
                      {item.pinned && (
                        <span className="badge-theme bg-red-500/12 text-red-600 dark:text-red-400">置顶</span>
                      )}
                      {item.status !== 'published' && (
                        <span className="badge-theme bg-[color-mix(in_srgb,var(--c-muted)_18%,transparent)] text-muted">
                          草稿
                        </span>
                      )}
                      {expired && (
                        <span className="badge-theme bg-amber-500/12 text-amber-700 dark:text-amber-400">
                          已过期
                        </span>
                      )}
                      <span className={cn('badge-theme', meta.className)}>{meta.label}</span>
                    </div>

                    {item.content && (
                      <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{item.content}</p>
                    )}

                    <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>发布于 {formatDateCN(item.startsAt ?? item.createdAt)}</span>
                      {item.endsAt && <span>有效期至 {formatDateCN(item.endsAt)}</span>}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => togglePinned(item)}
                      className={cn(
                        'rounded p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                        item.pinned ? 'text-red-500' : 'text-muted',
                      )}
                      title={item.pinned ? '取消置顶' : '置顶'}
                      aria-label={item.pinned ? '取消置顶' : '置顶'}
                    >
                      <Pin size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(item)}
                      className="rounded p-2 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                      title={item.status === 'published' ? '转为草稿' : '发布'}
                      aria-label={item.status === 'published' ? '转为草稿' : '发布'}
                    >
                      <Power size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded p-2 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                      aria-label={`编辑 ${item.title}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      className="rounded p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                      aria-label={`删除 ${item.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? '编辑公告' : '发布公告'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Spinner />}
              {editing ? '保存修改' : '发布'}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="公告标题" required>
            <input
              className="input-theme"
              value={form.title}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, title: event.target.value }))
                setFormError('')
              }}
              placeholder="例如 关于国庆假期安排的通知"
              maxLength={200}
              autoFocus
            />
          </Field>

          <Field label="公告内容">
            <textarea
              className="input-theme min-h-28 resize-y"
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="简要说明内容，支持换行"
              maxLength={2000}
            />
          </Field>

          <Field label="重要程度">
            <div className="flex gap-2">
              {(Object.keys(LEVEL_META) as Array<Announcement['level']>).map((level) => {
                const meta = LEVEL_META[level]
                const Icon = meta.icon
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, level }))}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-theme border py-2 text-sm transition-colors',
                      form.level === level
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border text-muted hover:text-fg',
                    )}
                  >
                    <Icon size={14} aria-hidden />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="生效时间" hint="选填">
              <input
                type="datetime-local"
                className="input-theme"
                value={form.startsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
              />
            </Field>
            <Field label="失效时间" hint="过期后前台自动隐藏">
              <input
                type="datetime-local"
                className="input-theme"
                value={form.endsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(event) => setForm((prev) => ({ ...prev, pinned: event.target.checked }))}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-primary)]"
              />
              <span className="text-sm">
                <span className="font-medium">置顶</span>
                <span className="mt-0.5 block text-xs text-muted">排在公告列表最前</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.status === 'published'}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.checked ? 'published' : 'draft' }))
                }
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-primary)]"
              />
              <span className="text-sm">
                <span className="font-medium">立即发布</span>
                <span className="mt-0.5 block text-xs text-muted">取消则保存为草稿，前台不显示</span>
              </span>
            </label>
          </div>

          {formError && (
            <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="删除公告"
        message={`确定要删除公告「${confirmDelete?.title ?? ''}」吗？`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
