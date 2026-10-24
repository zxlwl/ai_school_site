/**
 * 主题详情页 — 首楼 + 回复列表 + 回复框。
 *
 * 回复权限、锁定状态等都以服务端返回的字段为准，前端只做体验层的
 * 提示（比如锁定后禁用输入框），真正的拦截在后端。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CornerDownRight,
  Eye,
  Lock,
  MessageSquare,
  MessageSquareReply,
  Pin,
  Send,
  Trash2,
} from 'lucide-react'
import type { ForumPost, ForumTopic } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { ApiError, accountApi, forumApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Markdown } from '../../components/markdown'
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  Spinner,
  toast,
} from '../../components/ui'
import { Avatar } from './BoardPage'

export function TopicPage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1) || 1

  const { data, loading, error, reload, setData } = useAsync(
    () => forumApi.topic(slug, { page, pageSize: 30 }),
    [slug, page],
  )

  const [me, setMe] = useState<{ id: number; displayName: string } | null>(null)
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    accountApi
      .session()
      .then((session) => {
        if (cancelled) return
        if (session?.authenticated && session.user) {
          setMe({ id: session.user.id, displayName: session.user.displayName })
        } else {
          setMe(null)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const topic = data?.topic
  const posts = data?.posts ?? []
  const pagination = data?.pagination

  const canReply = Boolean(me) && Boolean(topic) && topic!.status === 'published' && !topic!.locked

  const onReply = (post: ForumPost) => {
    setReplyTo({ id: post.id, name: post.author.displayName })
    textareaRef.current?.focus()
  }

  const submit = async () => {
    if (!topic || !content.trim()) return
    setSending(true)
    try {
      const result = await forumApi.reply(topic.id, {
        content: content.trim(),
        replyTo: replyTo?.id ?? null,
      })
      // 把新回复追加到当前列表，避免整页重载丢失滚动位置
      setData((prev) =>
        prev
          ? {
              ...prev,
              posts: [...prev.posts, result.post],
              topic: { ...prev.topic, replyCount: prev.topic.replyCount + 1 },
            }
          : prev,
      )
      setContent('')
      setReplyTo(null)
      toast.success('回复成功')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '回复失败，请稍后重试')
    } finally {
      setSending(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="container-theme py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-4 h-40 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container-theme py-16">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="container-theme py-16">
        <EmptyState title="主题不存在" description="它可能已被删除或隐藏" />
      </div>
    )
  }

  return (
    <div className="container-theme py-8 md:py-10">
      <Breadcrumbs
        items={[
          { label: '首页', to: '/' },
          { label: '校园论坛', to: '/forum' },
          { label: data!.board.name, to: `/forum/b/${data!.board.slug}` },
          { label: '主题' },
        ]}
      />

      {/* 首楼 */}
      <article className="card-theme mt-4 overflow-hidden">
        <header className="border-b border-border px-5 py-4">
          <h1 className="flex items-start gap-2 text-xl font-bold leading-snug tracking-tight md:text-2xl">
            {topic.pinned && <Pin size={16} className="mt-1.5 shrink-0 text-primary" aria-label="置顶" />}
            {topic.locked && <Lock size={16} className="mt-1.5 shrink-0 text-muted" aria-label="已锁定" />}
            <span>{topic.title}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Avatar author={topic.author} size={20} />
              <span className="font-medium text-fg/80">{topic.author.displayName}</span>
            </span>
            <span>发布于 {formatDateCN(topic.createdAt)}</span>
            <span className="inline-flex items-center gap-0.5">
              <Eye size={11} aria-hidden />
              {topic.views}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare size={11} aria-hidden />
              {topic.replyCount}
            </span>
          </div>
        </header>
        <div className="px-5 py-5">
          <Markdown source={topic.content} />
        </div>
      </article>

      {/* 回复列表 */}
      <section className="mt-6">
        <h2 className="text-base font-semibold">
          全部回复
          {pagination && pagination.total > 0 && (
            <span className="ml-1.5 font-normal text-muted">({pagination.total})</span>
          )}
        </h2>

        <div className="mt-3">
          {posts.length === 0 ? (
            <div className="card-theme px-5 py-10 text-center text-sm text-muted">
              还没有人回复，来说两句吧
            </div>
          ) : (
            <div className="grid gap-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  canDelete={Boolean(me) && me!.id === post.author.id}
                  onReply={() => onReply(post)}
                  onDeleted={() => reload()}
                />
              ))}
            </div>
          )}
        </div>

        {pagination && pagination.total > pagination.pageSize && (
          <div className="mt-5">
            <Pagination
              page={pagination.page}
              totalPages={Math.ceil(pagination.total / pagination.pageSize)}
              onChange={(next) => {
                const p = new URLSearchParams(params)
                p.set('page', String(next))
                setParams(p, { replace: true })
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        )}
      </section>

      {/* 回复框 */}
      <section className="mt-6">
        {!me ? (
          <div className="card-theme px-5 py-6 text-center text-sm text-muted">
            请先
            <Link to={`/login?redirect=${encodeURIComponent(`/forum/t/${slug}`)}`} className="mx-1 font-medium text-primary hover:underline">
              登录
            </Link>
            后再回复
          </div>
        ) : topic.locked ? (
          <div className="card-theme px-5 py-6 text-center text-sm text-muted">
            该主题已被锁定，无法回复
          </div>
        ) : (
          <div className="card-theme p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">发表回复</p>
              {replyTo && (
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
                >
                  <CornerDownRight size={12} aria-hidden />
                  正在回复 {replyTo.name}（点击取消）
                </button>
              )}
            </div>

            <textarea
              ref={textareaRef}
              className="input-theme mt-2.5 min-h-28 resize-y"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="说点什么…（支持 Markdown）"
            />

            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-xs text-muted">{content.length} 字</span>
              <button
                type="button"
                className="btn-primary"
                onClick={submit}
                disabled={sending || !content.trim()}
              >
                {sending ? <Spinner /> : <Send size={14} aria-hidden />}
                发送
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function PostCard({
  post,
  canDelete,
  onReply,
  onDeleted,
}: {
  post: ForumPost
  canDelete: boolean
  onReply: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    if (!window.confirm('确定删除这条回复吗？')) return
    setDeleting(true)
    try {
      await forumApi.deletePost(post.id)
      toast.success('已删除')
      onDeleted()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="card-theme px-4 py-3.5">
      <header className="flex items-center gap-2">
        <Avatar author={post.author} size={26} />
        <span className="text-[13px] font-medium">{post.author.displayName}</span>
        <span className="text-[11px] text-muted">{formatDateCN(post.createdAt)}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onReply}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted transition-colors hover:text-primary"
          >
            <MessageSquareReply size={12} aria-hidden />
            回复
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted transition-colors hover:text-red-500"
            >
              <Trash2 size={12} aria-hidden />
              删除
            </button>
          )}
        </div>
      </header>

      {post.replyToAuthor && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-theme bg-[color-mix(in_srgb,var(--c-muted)_9%,transparent)] px-2 py-0.5 text-[11px] text-muted">
          <CornerDownRight size={10} aria-hidden />
          回复 {post.replyToAuthor}
        </p>
      )}

      <div className="mt-2">
        <Markdown source={post.content} />
      </div>
    </article>
  )
}
