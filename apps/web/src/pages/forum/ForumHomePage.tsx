/**
 * 论坛首页 — 版块列表 + 最新主题。
 */

import { Link } from 'react-router-dom'
import { Flame, MessageSquare, MessagesSquare, Pin } from 'lucide-react'
import type { ForumBoard, ForumTopicSummary } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { forumApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { Breadcrumbs, EmptyState, ErrorState, Skeleton } from '../../components/ui'

export function ForumHomePage() {
  const { data: boardsData, loading: loadingBoards, error: errBoards, reload } = useAsync(
    () => forumApi.boards(),
    [],
  )
  const { data: recentData, loading: loadingRecent } = useAsync(() => forumApi.recent(8), [])

  const boards = boardsData?.boards ?? []
  const recent = recentData?.topics ?? []

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs items={[{ label: '首页', to: '/' }, { label: '校园论坛' }]} />

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">校园论坛</h1>
          <p className="mt-2 text-sm text-muted">同学之间交流讨论、分享见闻的地方</p>
        </div>
        <Link to="/forum/new" className="btn-primary">
          <MessageSquare size={15} aria-hidden />
          发帖
        </Link>
      </header>

      {errBoards ? (
        <div className="mt-8">
          <ErrorState message={errBoards} onRetry={reload} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          {/* 版块列表 */}
          <section>
            <h2 className="text-base font-semibold">版块</h2>
            <div className="mt-3">
              {loadingBoards && !boardsData ? (
                <div className="grid gap-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : boards.length === 0 ? (
                <EmptyState
                  title="还没有版块"
                  description="管理员尚未创建任何讨论版块"
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {boards.map((board) => (
                    <BoardCard key={board.id} board={board} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 最新主题 */}
          <aside>
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              <Flame size={15} className="text-primary" aria-hidden />
              最新动态
            </h2>
            <div className="card-theme mt-3 divide-y divide-border">
              {loadingRecent && !recentData ? (
                <div className="grid gap-2 p-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <p className="p-4 text-sm text-muted">还没有人发帖</p>
              ) : (
                recent.map((topic) => (
                  <Link
                    key={topic.id}
                    to={`/forum/t/${topic.slug}`}
                    className="block px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--c-muted)_7%,transparent)]"
                  >
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug">{topic.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                      <span>{topic.author.displayName}</span>
                      <span>·</span>
                      <span>{formatDateCN(topic.lastReplyAt ?? topic.createdAt)}</span>
                      {topic.replyCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <MessageSquare size={10} aria-hidden />
                            {topic.replyCount}
                          </span>
                        </>
                      )}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function BoardCard({ board }: { board: ForumBoard }) {
  return (
    <Link
      to={`/forum/b/${board.slug}`}
      className="card-theme group flex gap-3 p-4 transition-colors hover:border-primary/40"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-theme"
        style={{
          backgroundColor: board.color
            ? `color-mix(in srgb, ${board.color} 16%, transparent)`
            : 'color-mix(in srgb, var(--c-primary) 12%, transparent)',
          color: board.color || 'var(--c-primary)',
        }}
        aria-hidden
      >
        <MessagesSquare size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold group-hover:text-primary">{board.name}</p>
        {board.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{board.description}</p>
        )}
        <p className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
          <span>{board.topicCount ?? 0} 个主题</span>
          {board.lastActivityAt && (
            <>
              <span>·</span>
              <span>最近 {formatDateCN(board.lastActivityAt)}</span>
            </>
          )}
        </p>
      </div>
    </Link>
  )
}
