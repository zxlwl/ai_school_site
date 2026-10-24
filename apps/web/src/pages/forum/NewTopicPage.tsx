/**
 * 发帖页 — 需登录。
 *
 * 版块可从 ?board=slug 预选（从版块页点「发帖」过来时带上）。
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { ApiError, accountApi, forumApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Breadcrumbs, Field, LoadingState, Spinner, toast } from '../../components/ui'

export function NewTopicPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetBoard = params.get('board') ?? ''

  const [boardId, setBoardId] = useState<number | ''>('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  const { data } = useAsync(() => forumApi.boards(), [])
  const boards = data?.boards ?? []

  // 登录校验：未登录直接引导，不要等提交后才报错
  useEffect(() => {
    let cancelled = false
    accountApi
      .session()
      .then((session) => {
        if (!cancelled) setLoggedIn(Boolean(session?.authenticated))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 预选版块：等版块列表加载完再匹配 slug
  useEffect(() => {
    if (!presetBoard || boards.length === 0) return
    const hit = boards.find((b) => b.slug === presetBoard)
    if (hit) setBoardId(hit.id)
  }, [presetBoard, boards])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!boardId) {
      setError('请选择版块')
      return
    }
    if (title.trim().length < 2) {
      setError('标题至少 2 个字')
      return
    }
    if (content.trim().length < 2) {
      setError('正文不能为空')
      return
    }

    setSubmitting(true)
    try {
      const result = await forumApi.createTopic({
        boardId: Number(boardId),
        title: title.trim(),
        content: content.trim(),
      })
      if (result.pending) {
        toast.success('已提交，等待管理员审核后公开')
      } else {
        toast.success('发布成功')
      }
      navigate(`/forum/t/${result.topic.slug}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发布失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) return <LoadingState label="正在检查登录状态…" minHeight={320} />

  if (!loggedIn) {
    return (
      <div className="container-theme flex flex-col items-center py-20 text-center">
        <h1 className="text-lg font-semibold">请先登录</h1>
        <p className="mt-1.5 text-sm text-muted">发帖需要登录会员账号</p>
        <div className="mt-5 flex gap-3">
          <Link to={`/login?redirect=${encodeURIComponent('/forum/new')}`} className="btn-primary">
            去登录
          </Link>
          <Link to="/forum" className="btn-ghost">
            返回论坛
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-theme max-w-3xl py-8 md:py-10">
      <Breadcrumbs
        items={[
          { label: '首页', to: '/' },
          { label: '校园论坛', to: '/forum' },
          { label: '发帖' },
        ]}
      />

      <h1 className="mt-4 text-2xl font-bold tracking-tight">发布新主题</h1>

      <form onSubmit={submit} className="card-theme mt-5 grid gap-4 p-5">
        <Field label="版块" required>
          <select
            className="input-theme"
            value={boardId}
            onChange={(event) => setBoardId(event.target.value ? Number(event.target.value) : '')}
          >
            <option value="">请选择版块</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="标题" required hint="2-200 个字，说清楚要讨论什么">
          <input
            className="input-theme"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="给帖子起个标题"
            maxLength={200}
          />
        </Field>

        <Field label="正文" required hint="支持 Markdown">
          <textarea
            className="input-theme min-h-56 resize-y font-mono text-[13px]"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="详细描述你的想法…"
          />
        </Field>

        {error && (
          <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{content.length} 字</span>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? <Spinner /> : <Send size={14} aria-hidden />}
            发布
          </button>
        </div>
      </form>
    </div>
  )
}
