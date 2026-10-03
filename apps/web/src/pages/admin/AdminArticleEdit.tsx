/**
 * 后台文章编辑器 — 新建与编辑共用。
 *
 * 编辑器分左右两栏：左侧写标题与正文，右侧设置分类、封面、标签、状态。
 * 正文支持 Markdown 并带实时预览，保存时不做任何 HTML 拼接，全部原样交给后端。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  ImagePlus,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { deriveExcerpt } from '@school/shared'
import { ApiError, adminApi } from '../../lib/api'
import { useAsync, useCategories } from '../../lib/hooks'
import { Markdown } from '../../components/markdown'
import { ConfirmDialog, Field, Spinner, cn, toast } from '../../components/ui'

interface FormState {
  title: string
  slug: string
  summary: string
  content: string
  categoryId: string
  coverImage: string
  author: string
  status: 'draft' | 'published'
  featured: boolean
  publishedAt: string
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  categoryId: '',
  coverImage: '',
  author: '',
  status: 'draft',
  featured: false,
  publishedAt: '',
}

/** 把 ISO 字符串转成 <input type="datetime-local"> 需要的本地格式 */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function AdminArticleEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(!isEdit)

  const contentRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const categoriesState = useCategories()

  // 编辑模式：拉取文章原文
  useEffect(() => {
    if (!isEdit || !id) return
    let cancelled = false
    adminApi
      .article(Number(id))
      .then((article) => {
        if (cancelled) return
        setForm({
          title: article.title,
          slug: article.slug,
          summary: article.excerpt ?? '',
          content: article.content,
          categoryId: article.category ? String(article.category.id) : '',
          coverImage: article.coverImage ?? '',
          author: article.author ?? '',
          status: article.status,
          featured: article.featured,
          publishedAt: toLocalInput(article.publishedAt),
        })
        setLoaded(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        toast.error(err instanceof ApiError ? err.message : '加载文章失败')
        navigate('/admin/articles', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [id, isEdit, navigate])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validate = useCallback(() => {
    const next: Record<string, string> = {}
    if (!form.title.trim()) next.title = '请填写文章标题'
    else if (form.title.length > 200) next.title = '标题不能超过 200 字'
    if (!form.content.trim()) next.content = '请填写文章正文'
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form.title, form.content])

  const buildPayload = (status: FormState['status']) => ({
    title: form.title.trim(),
    slug: form.slug.trim() || undefined, // 留空交由后端按标题生成
    excerpt: form.summary.trim() || undefined,
    content: form.content,
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    coverImage: form.coverImage.trim() || null,
    author: form.author.trim() || null,
    status,
    featured: form.featured,
    publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
  })

  const save = async (status: FormState['status']) => {
    if (!validate()) {
      toast.error('请先补全必填内容')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload(status)
      if (isEdit && id) {
        await adminApi.updateArticle(Number(id), payload)
        toast.success(status === 'published' ? '已保存并发布' : '草稿已保存')
        setForm((prev) => ({ ...prev, status }))
      } else {
        const result = await adminApi.createArticle(payload)
        toast.success(status === 'published' ? '文章已发布' : '草稿已创建')
        navigate(`/admin/articles/${result.id}`, { replace: true })
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await adminApi.deleteArticle(Number(id))
      toast.success('文章已删除')
      navigate('/admin/articles', { replace: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  /** 上传封面：读成 base64 交给后端，由存储驱动决定最终形态 */
  const handleCoverUpload = async (file: File) => {
    if (file.size > 1_400_000) {
      toast.error('图片过大，请压缩到 1.4MB 以内（或改用外链图片地址）')
      return
    }
    setUploading(true)
    try {
      const base64 = await fileToBase64(file)
      const result = await adminApi.uploadConfig().then(() =>
        fetchUpload({ filename: file.name, mimeType: file.type, data: base64 }),
      )
      update('coverImage', result)
      toast.success('封面上传成功')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  /** 在正文光标处插入 Markdown 片段，保持写作流畅 */
  const insertAtCursor = (snippet: string) => {
    const textarea = contentRef.current
    if (!textarea) {
      update('content', `${form.content}\n${snippet}`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = `${form.content.slice(0, start)}${snippet}${form.content.slice(end)}`
    update('content', next)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + snippet.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const handlePasteImage = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    if (file.size > 1_400_000) {
      toast.error('粘贴的图片过大，请压缩后重试')
      return
    }
    try {
      const base64 = await fileToBase64(file)
      const url = await fetchUpload({ filename: file.name || 'pasted.png', mimeType: file.type, data: base64 })
      insertAtCursor(`\n![${file.name || '图片'}](${url})\n`)
      toast.success('图片已插入')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '图片上传失败')
    }
  }

  const wordCount = useMemo(() => form.content.replace(/\s+/g, '').length, [form.content])

  if (!loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/admin/articles" className="btn-ghost !px-2.5 !py-1.5" aria-label="返回文章列表">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{isEdit ? '编辑文章' : '新建文章'}</h1>
            <p className="mt-0.5 text-xs text-muted">
              {form.status === 'published' ? '已发布' : '草稿'} · 正文 {wordCount} 字
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => setShowPreview((value) => !value)}>
            <Eye size={15} aria-hidden />
            {showPreview ? '收起预览' : '预览'}
          </button>
          {isEdit && (
            <button
              type="button"
              className="btn-ghost !text-red-600 dark:!text-red-400"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} aria-hidden />
              删除
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => save('draft')} disabled={saving}>
            {saving ? <Spinner /> : <Save size={15} aria-hidden />}
            存为草稿
          </button>
          <button type="button" className="btn-primary" onClick={() => save('published')} disabled={saving}>
            {saving ? <Spinner /> : <Send size={15} aria-hidden />}
            {form.status === 'published' ? '更新' : '发布'}
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* ---------------------------- 主编辑区 ---------------------------- */}
        <div className="space-y-4">
          <div className="card-theme p-5">
            <Field label="文章标题" required error={errors.title}>
              <input
                className="input-theme !text-lg !font-semibold"
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder="输入一个清晰、具体的标题"
                maxLength={200}
              />
            </Field>

            <div className="mt-4">
              <Field label="摘要" hint="留空则自动截取正文前 200 字">
                <textarea
                  className="input-theme min-h-20 resize-y"
                  value={form.summary}
                  onChange={(event) => update('summary', event.target.value)}
                  placeholder="一两句话概括文章要点，会显示在列表卡片与搜索结果中"
                  maxLength={500}
                />
              </Field>
              {!form.summary && form.content && (
                <button
                  type="button"
                  className="mt-2 text-xs text-primary"
                  onClick={() => update('summary', deriveExcerpt(form.content, 200))}
                >
                  从正文自动生成摘要
                </button>
              )}
            </div>
          </div>

          <div className="card-theme">
            {/* 编辑器工具条 */}
            <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
              <ToolButton label="标题" onClick={() => insertAtCursor('\n## 小标题\n')} />
              <ToolButton label="加粗" onClick={() => insertAtCursor('**加粗文字**')} />
              <ToolButton label="斜体" onClick={() => insertAtCursor('*斜体文字*')} />
              <ToolButton label="链接" onClick={() => insertAtCursor('[链接文字](https://)')} />
              <ToolButton label="列表" onClick={() => insertAtCursor('\n- 列表项\n- 列表项\n')} />
              <ToolButton label="引用" onClick={() => insertAtCursor('\n> 引用内容\n')} />
              <ToolButton label="代码" onClick={() => insertAtCursor('\n```\n代码\n```\n')} />
              <ToolButton label="表格" onClick={() => insertAtCursor('\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n')} />
              <ToolButton label="分割线" onClick={() => insertAtCursor('\n---\n')} />

              <div className="ml-auto flex items-center gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      fileToBase64(file)
                        .then((base64) =>
                          fetchUpload({ filename: file.name, mimeType: file.type, data: base64 }),
                        )
                        .then((url) => {
                          insertAtCursor(`\n![${file.name}](${url})\n`)
                          toast.success('图片已插入')
                        })
                        .catch((err) =>
                          toast.error(err instanceof ApiError ? err.message : '图片上传失败'),
                        )
                    }
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={13} className="mr-1 inline" aria-hidden />
                  插入图片
                </button>
              </div>
            </div>

            <div className={cn('grid', showPreview && 'lg:grid-cols-2 lg:divide-x lg:divide-border')}>
              <div className="p-1">
                <textarea
                  ref={contentRef}
                  className="min-h-[32rem] w-full resize-y rounded-theme border-0 bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
                  value={form.content}
                  onChange={(event) => update('content', event.target.value)}
                  onPaste={handlePasteImage}
                  placeholder={'在这里撰写正文，支持 Markdown：\n\n## 二级标题\n\n**加粗**、*斜体*、[链接](https://example.com)\n\n- 列表项\n\n> 引用\n\n直接粘贴截图也能自动上传。'}
                  spellCheck={false}
                />
              </div>

              {showPreview && (
                <div className="border-t border-border p-5 lg:border-t-0">
                  <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">实时预览</p>
                  {form.content.trim() ? (
                    <Markdown source={form.content} />
                  ) : (
                    <p className="text-sm text-muted">开始输入正文后，这里会显示渲染效果。</p>
                  )}
                </div>
              )}
            </div>

            {errors.content && <p className="px-4 pb-3 text-xs text-red-500">{errors.content}</p>}
          </div>
        </div>

        {/* ---------------------------- 侧栏设置 ---------------------------- */}
        <aside className="space-y-4">
          <section className="card-theme p-5">
            <h2 className="text-sm font-semibold">发布设置</h2>

            <div className="mt-4 grid gap-4">
              <Field label="状态">
                <select
                  className="input-theme"
                  value={form.status}
                  onChange={(event) => update('status', event.target.value as FormState['status'])}
                >
                  <option value="draft">草稿（前台不可见）</option>
                  <option value="published">已发布</option>
                </select>
              </Field>

              <Field label="发布时间" hint="留空则使用当前时间">
                <input
                  type="datetime-local"
                  className="input-theme"
                  value={form.publishedAt}
                  onChange={(event) => update('publishedAt', event.target.value)}
                />
              </Field>

              <Field label="文章链接（slug）" hint="留空自动生成">
                <input
                  className="input-theme font-mono text-xs"
                  value={form.slug}
                  onChange={(event) => update('slug', event.target.value)}
                  placeholder="例如 campus-news-2025"
                  maxLength={160}
                />
              </Field>

              <Field label="作者">
                <input
                  className="input-theme"
                  value={form.author}
                  onChange={(event) => update('author', event.target.value)}
                  placeholder="例如 校办"
                  maxLength={80}
                />
              </Field>
            </div>
          </section>

          <section className="card-theme p-5">
            <h2 className="text-sm font-semibold">分类与标签</h2>

            <div className="mt-4 grid gap-4">
              <Field label="所属分类">
                <select
                  className="input-theme"
                  value={form.categoryId}
                  onChange={(event) => update('categoryId', event.target.value)}
                >
                  <option value="">未分类</option>
                  {(categoriesState.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="card-theme p-5">
            <h2 className="text-sm font-semibold">封面图</h2>

            {form.coverImage ? (
              <div className="relative mt-3">
                <img
                  src={form.coverImage}
                  alt="封面预览"
                  className="w-full rounded-theme object-cover"
                  style={{ maxHeight: '10rem' }}
                />
                <button
                  type="button"
                  onClick={() => update('coverImage', '')}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                  aria-label="移除封面"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById('cover-upload')?.click()}
                className="mt-3 flex w-full flex-col items-center gap-2 rounded-theme border border-dashed border-border py-7 text-muted transition-colors hover:border-primary hover:text-primary"
              >
                {uploading ? <Spinner /> : <ImagePlus size={20} aria-hidden />}
                <span className="text-xs">{uploading ? '上传中…' : '点击上传封面'}</span>
              </button>
            )}

            <input
              id="cover-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleCoverUpload(file)
                event.target.value = ''
              }}
            />

            <div className="mt-3">
              <Field label="或填写图片地址">
                <input
                  className="input-theme font-mono text-xs"
                  value={form.coverImage.startsWith('data:') ? '' : form.coverImage}
                  onChange={(event) => update('coverImage', event.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </section>

          <section className="card-theme p-5">
            <h2 className="text-sm font-semibold">展示选项</h2>
            <div className="mt-4 grid gap-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => update('featured', event.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-primary)]"
                />
                <span className="text-sm">
                  <span className="font-medium">推荐到首页</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    置顶至列表首位，并显示在首页「推荐阅读」区块
                  </span>
                </span>
              </label>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除文章"
        message={`确定要删除「${form.title || '这篇文章'}」吗？该操作不可撤销。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function ToolButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
    >
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      // 去掉 data:image/png;base64, 前缀，只保留 payload
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.onerror = () => reject(new ApiError(0, 'read_error', '无法读取文件'))
    reader.readAsDataURL(file)
  })
}

/** 上传并返回可访问的 URL */
async function fetchUpload(payload: { filename: string; mimeType: string; data: string }): Promise<string> {
  const { uploadMedia } = await import('../../lib/upload')
  return uploadMedia(payload)
}
