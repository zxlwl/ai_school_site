/**
 * 分类管理 — 增删改 + 排序。
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Category } from '@school/shared'
import { ApiError, adminApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import {
  ColorInput,
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
  name: string
  slug: string
  description: string
  color: string
  sortOrder: number
}

const EMPTY: FormState = { name: '', slug: '', description: '', color: '#2563eb', sortOrder: 0 }

export default function AdminCategories() {
  const { data, loading, error, reload } = useAsync<Category[]>(() => adminApi.categories(), [])
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState('')

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY, sortOrder: (data?.length ?? 0) })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      color: category.color ?? '#2563eb',
      sortOrder: category.sortOrder,
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('请填写分类名称')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        color: form.color,
        sortOrder: Number(form.sortOrder) || 0,
      }
      if (editing) {
        await adminApi.updateCategory(editing.id, payload)
        toast.success('分类已更新')
      } else {
        await adminApi.createCategory(payload)
        toast.success('分类已创建')
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '保存失败'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await adminApi.deleteCategory(confirmDelete.id)
      toast.success('分类已删除')
      setConfirmDelete(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  /** 上移 / 下移：与相邻分类交换 sortOrder */
  const move = async (category: Category, direction: -1 | 1) => {
    const list = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = list.findIndex((item) => item.id === category.id)
    const target = list[index + direction]
    if (!target) return

    try {
      await Promise.all([
        adminApi.updateCategory(category.id, { sortOrder: target.sortOrder }),
        adminApi.updateCategory(target.id, { sortOrder: category.sortOrder }),
      ])
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '排序失败')
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">分类管理</h1>
          <p className="mt-1 text-sm text-muted">分类会出现在前台导航与筛选栏中，排序决定展示顺序</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={15} aria-hidden />
          新建分类
        </button>
      </header>

      <div className="card-theme mt-5 overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="还没有分类"
            description="创建第一个分类，把文章按主题组织起来。"
            action={
              <button type="button" className="btn-primary mt-1" onClick={openCreate}>
                新建分类
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {[...data]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((category) => (
                <li key={category.id} className="flex items-center gap-4 px-5 py-3.5">
                  {/* 排序按钮 */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(category, -1)}
                      className="rounded p-0.5 text-muted transition-colors hover:text-fg disabled:opacity-30"
                      aria-label="上移"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(category, 1)}
                      className="rounded p-0.5 text-muted transition-colors hover:text-fg disabled:opacity-30"
                      aria-label="下移"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-theme"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${category.color ?? 'var(--c-primary)'} 14%, transparent)`,
                      color: category.color ?? 'var(--c-primary)',
                    }}
                    aria-hidden
                  >
                    <FolderTree size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{category.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <span className="font-mono">/{category.slug}</span>
                      <span>·</span>
                      <span>{category.articleCount ?? 0} 篇文章</span>
                    </p>
                    {category.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted">{category.description}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="rounded p-2 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                      aria-label={`编辑 ${category.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(category)}
                      className="rounded p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                      aria-label={`删除 ${category.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* 新建 / 编辑弹窗 */}
      <Modal
        open={modalOpen}
        title={editing ? `编辑分类：${editing.name}` : '新建分类'}
        onClose={() => setModalOpen(false)}
        width="max-w-lg"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
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
          <Field label="分类名称" required>
            <input
              className="input-theme"
              value={form.name}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, name: event.target.value }))
                setFormError('')
              }}
              placeholder="例如 校园新闻"
              maxLength={80}
              autoFocus
            />
          </Field>

          <Field label="链接标识（slug）" hint="留空自动生成">
            <input
              className="input-theme font-mono text-xs"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="campus-news"
              maxLength={80}
            />
          </Field>

          <Field label="分类描述" hint="显示在分类页顶部">
            <textarea
              className="input-theme min-h-20 resize-y"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              maxLength={300}
            />
          </Field>

          <Field label="主题色" hint="用于标签与图标底色">
            <ColorInput
              value={form.color}
              onChange={(value) => setForm((prev) => ({ ...prev, color: value }))}
              label="分类主题色"
            />
          </Field>

          <Field label="排序值" hint="数字越小越靠前">
            <input
              type="number"
              className="input-theme"
              value={form.sortOrder}
              onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
            />
          </Field>

          {formError && (
            <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="删除分类"
        message={`确定要删除分类「${confirmDelete?.name ?? ''}」吗？该分类下的 ${confirmDelete?.articleCount ?? 0} 篇文章不会被删除，但会变成「未分类」。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
