/**
 * 单页管理 — 关于我们 / 联系方式 / 招生简章等静态页面。
 *
 * 单页与文章共用 Markdown 渲染，但不出现在文章列表中，
 * 而是作为导航项挂在页头与页脚。
 */

import { useCallback, useMemo, useState } from 'react'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ContentStatus, Page, PageInput } from '@school/shared'
import { ApiError, adminApi } from '../../lib/api'
import { toMessage, useAsync } from '../../lib/hooks'
import { Markdown, toPlainText } from '../../components/markdown'
import {
  ConfirmDialog,
  DateText,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Skeleton,
  StatusBadge,
  Switch,
  toast,
} from '../../components/ui'

interface FormState {
  title: string
  slug: string
  summary: string
  content: string
  sortOrder: number
  status: ContentStatus
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  sortOrder: 0,
  status: 'published',
}

export default function AdminPages() {
  const { data, loading, error, reload } = useAsync<Page[]>(
    () => adminApi.pages(),
    [],
  )
  const [editing, setEditing] = useState<Page | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Page | null>(null)

  const pages = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setPreview(false)
    setOpen(true)
  }

  const openEdit = (page: Page) => {
    setEditing(page)
    setForm({
      title: page.title,
      slug: page.slug,
      summary: page.summary ?? '',
      content: page.content,
      sortOrder: page.sortOrder,
      status: page.status,
    })
    setFormError(null)
    setPreview(false)
    setOpen(true)
  }

  const patch = useCallback((next: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...next }))
  }, [])

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('请填写页面标题')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload: PageInput = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim() || null,
        content: form.content,
        sortOrder: form.sortOrder,
        status: form.status,
      }
      if (editing) {
        await adminApi.updatePage(editing.id, payload)
        toast.success('页面已更新')
      } else {
        await adminApi.createPage(payload)
        toast.success('页面已创建')
      }
      setOpen(false)
      reload()
    } catch (err) {
      setFormError(toMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await adminApi.deletePage(confirmDelete.id)
      toast.success('页面已删除')
      setConfirmDelete(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">单页管理</h1>
          <p className="mt-1 text-sm text-muted">
            用于「关于我们」「联系方式」等固定内容，会自动加入页头与页脚导航。
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={15} aria-hidden />
          新建单页
        </button>
      </header>

      <div className="mt-5 grid gap-3">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          [0, 1].map((index) => <Skeleton key={index} className="h-20 w-full" />)
        ) : pages.length === 0 ? (
          <div className="card-theme">
            <EmptyState
              title="还没有自定义页面"
              description="创建一个页面来介绍学校、公布招生信息或说明联系方式。"
              action={
                <button type="button" className="btn-primary mt-1" onClick={openCreate}>
                  新建单页
                </button>
              }
            />
          </div>
        ) : (
          pages.map((page) => (
            <article
              key={page.id}
              className="card-theme flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold">{page.title}</h2>
                  <StatusBadge published={page.status === 'published'} />
                  {page.status !== 'published' && (
                    <span className="badge-theme bg-amber-500/12 text-amber-700 dark:text-amber-400">
                      未发布
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  /{page.slug} · 排序 {page.sortOrder}
                </p>
                {page.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{page.summary}</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  更新于 <DateText value={page.updatedAt} />
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openEdit(page)}
                  aria-label={`编辑 ${page.title}`}
                >
                  <Pencil size={15} aria-hidden />
                  编辑
                </button>
                <button
                  type="button"
                  className="btn-ghost text-red-600 dark:text-red-400"
                  onClick={() => setConfirmDelete(page)}
                  aria-label={`删除 ${page.title}`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `编辑页面：${editing.title}` : '新建单页'}
        width="max-w-4xl"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {editing ? '保存修改' : '创建页面'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-4">
            <Field label="页面标题" required>
              <input
                className="input-theme"
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="例如 关于我们"
              />
            </Field>
            <Field label="页面摘要" hint="显示在页面顶部">
              <input
                className="input-theme"
                value={form.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                placeholder="一句话概括这个页面"
              />
            </Field>
            <Field label="正文（Markdown）">
              <div className="mb-2 flex items-center gap-1.5">
                <button
                  type="button"
                  className={preview ? 'btn-ghost' : 'btn-primary'}
                  onClick={() => setPreview(false)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className={preview ? 'btn-primary' : 'btn-ghost'}
                  onClick={() => setPreview(true)}
                >
                  预览
                </button>
              </div>
              {preview ? (
                <div className="card-theme min-h-[18rem]">
                  {toPlainText(form.content) ? (
                    <Markdown source={form.content} />
                  ) : (
                    <p className="text-sm text-muted">正文为空</p>
                  )}
                </div>
              ) : (
                <textarea
                  className="input-theme min-h-[18rem] font-mono text-sm"
                  value={form.content}
                  onChange={(e) => patch({ content: e.target.value })}
                  placeholder={'## 标题\n\n正文内容，支持 **加粗**、列表、表格等 Markdown 语法。'}
                />
              )}
            </Field>
          </div>

          <div className="grid content-start gap-4">
            <Field label="链接标识（slug）" hint="留空自动生成">
              <input
                className="input-theme"
                value={form.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder="about"
              />
            </Field>
            <Field label="排序" hint="数字越小越靠前">
              <input
                type="number"
                className="input-theme"
                value={form.sortOrder}
                onChange={(e) => patch({ sortOrder: Number(e.target.value) || 0 })}
              />
            </Field>
            <Switch
              checked={form.status === 'published'}
              onChange={(value) => patch({ status: value ? 'published' : 'draft' })}
              label="立即发布"
              description="关闭后页面在前台不可访问"
            />
            <div className="card-theme bg-surface/60 text-xs text-muted">
              <p className="flex items-center gap-1.5 font-medium">
                <FileText size={13} aria-hidden />
                提示
              </p>
              <p className="mt-1">
                单页会自动出现在页头与页脚导航中，无需手动配置路由。
              </p>
            </div>
          </div>
        </div>
        {formError && (
          <p className="mt-3 rounded-theme bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="删除页面"
        message={`确定要删除页面「${confirmDelete?.title ?? ''}」吗？前台对应链接会立即失效。`}
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
