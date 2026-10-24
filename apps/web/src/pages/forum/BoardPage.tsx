/**
 * 版块页 — 某版块下的主题列表，支持排序与分页。
 */

import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Eye, Lock, MessageSquare, MessageSquarePlus, Pin } from 'lucide-react'
import type { ForumTopicSummary } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { forumApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  cn,
} from '../../components/ui'

const SORTS = [
  { value: 'latest', label: '最近回复' },
  { value: 'new', label: '最新发布' },
  { value: 'hot', label: '最多回复' },
] as const

export function BoardPage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1) || 1
  const sort = params.get('sort') ?? 'latest'

  const { data, loading, error, reload } = useAsync(
    () => forumApi.topics(slug, { page, pageSize: 20, sort }),
    [slug, page, sort],
  )

  const setSort = (next: string) => {
    const p = new URLSearchParams(params)
    p.set('sort', next)
    p.delete('page')
    setParams(p, { replace: true })
  }

  const setPage = (next: number) => {
    const p = new URLSearchParams(params)
    p.set('page', String(next))
    setParams(p, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const board = data?.board
  const topics = data?.topics ?? []
  const pagination = data?.pagination

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: '首页', to: '/' },
          { label: '校园论坛', to: '/forum' },
          { label: board?.name ?? '版块' },
        ]}
      />

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{board?.name ?? '版块'}</h1>
          {board?.description && <p className="mt-2 text-sm text-muted">{board.description}</p>}
          {pagination && (
            <p className="mt-1.5 text-xs text-muted">共 {pagination.total} 个主题</p>
          )}
        </div>
        <Link to={`/forum/new?board=${encodeURIComponent(slug)}`} className="btn-primary">
          <MessageSquarePlus size={15} aria-hidden />
          发帖
        </Link>
      </header>

      {/* 排序切换 */}
      <div className="mt-6 flex gap-1 rounded-theme border border-border bg-surface p-1 text-sm sm:inline-flex">
        {SORTS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setSort(item.value)}
            className={cn(
              'flex-1 rounded-[calc(var(--radius-theme)-4px)] px-3 py-1.5 text-[13px] font-medium transition-colors sm:flex-none',
              sort === item.value
                ? 'bg-primary/12 text-primary'
                : 'text-muted hover:text-fg',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="grid gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            title="这个版块还没有帖子"
            description="成为第一个发帖的人吧"
            action={
              <Link to={`/forum/new?board=${encodeURIComponent(slug)}`} className="btn-primary">
                发第一个帖
              </Link>
            }
          />
        ) : (
          <div className="card-theme divide-y divide-border">
            {topics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </div>

      {pagination && pagination.total > pagination.pageSize && (
        <div className="mt-6">
          <Pagination
            page={pagination.page}
            totalPages={Math.ceil(pagination.total / pagination.pageSize)}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  )
}

function TopicRow({ topic }: { topic: ForumTopicSummary }) {
  return (
    <Link
      to={`/forum/t/${topic.slug}`}
      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[color-mix(in_srgb,var(--c-muted)_7%,transparent)]"
    >
      <Avatar author={topic.author} />

      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-1.5 font-medium leading-snug">
          {topic.pinned && <Pin size={13} className="mt-0.5 shrink-0 text-primary" aria-label="置顶" />}
          {topic.locked && <Lock size={13} className="mt-0.5 shrink-0 text-muted" aria-label="已锁定" />}
          <span className="line-clamp-2">{topic.title}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span>{topic.author.displayName}</span>
          <span>·</span>
          <span>{formatDateCN(topic.createdAt)}</span>
          {topic.board && (
            <>
              <span>·</span>
              <span className="text-primary/80">{topic.board.name}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-0.5" title="回复数">
          <MessageSquare size={11} aria-hidden />
          {topic.replyCount}
        </span>
        <span className="hidden items-center gap-0.5 sm:inline-flex" title="浏览数">
          <Eye size={11} aria-hidden />
          {topic.views}
        </span>
      </div>
    </Link>
  )
}

/** 头像：有图用图，没图用显示名首字，避免为默认头像多发请求 */
export function Avatar({
  author,
  size = 32,
}: {
  author: { displayName: string; avatar: string | null }
  size?: number
}) {
  const dim = { width: size, height: size }
  if (author.avatar) {
    return (
      <img
        src={author.avatar}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={dim}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{
        ...dim,
        backgroundColor: 'color-mix(in srgb, var(--c-primary) 15%, transparent)',
        color: 'var(--c-primary)',
      }}
      aria-hidden
    >
      {author.displayName.slice(0, 1)}
    </span>
  )
}
