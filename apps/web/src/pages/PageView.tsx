/**
 * 公告列表页 与 通用单页（关于我们 / 联系方式 / 招生简章…）
 */

import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarDays, Info, Megaphone } from 'lucide-react'
import type { Announcement } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { useAnnouncements, usePage } from '../lib/hooks'
import { Markdown } from '../components/markdown'
import { Breadcrumbs, EmptyState, ErrorState, LoadingState, cn } from '../components/ui'

/* ------------------------------------------------------------------ */
/* 公告列表                                                            */
/* ------------------------------------------------------------------ */

const LEVEL_STYLE: Record<Announcement['level'], { icon: typeof Info; className: string; label: string }> = {
  info: { icon: Info, className: 'text-primary bg-primary/10', label: '通知' },
  important: { icon: Bell, className: 'text-amber-600 bg-amber-500/12 dark:text-amber-400', label: '重要' },
  urgent: { icon: AlertTriangle, className: 'text-red-600 bg-red-500/12 dark:text-red-400', label: '紧急' },
}

export function AnnouncementsPage() {
  const { data, loading, error, reload } = useAnnouncements()

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs items={[{ label: '首页', to: '/' }, { label: '通知公告' }]} />

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">通知公告</h1>
        <p className="mt-2 text-sm text-muted">学校发布的重要通知、活动安排与工作提醒</p>
      </header>

      <div className="mt-7">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState label="正在加载公告…" />
        ) : !data || data.length === 0 ? (
          <EmptyState title="暂无公告" description="学校还没有发布任何公告，请稍后再来。" />
        ) : (
          <div className="grid gap-4">
            {data.map((item) => {
              const style = LEVEL_STYLE[item.level]
              const Icon = style.icon

              return (
                <div key={item.id} className="card-theme flex gap-4 p-5 transition-all">
                  <span
                    className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-theme', style.className)}
                    aria-hidden
                  >
                    <Icon size={18} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium leading-snug">{item.title}</h2>
                      {item.pinned && (
                        <span className="badge-theme bg-red-500/12 text-red-600 dark:text-red-400">置顶</span>
                      )}
                      <span
                        className={cn(
                          'badge-theme',
                          item.level === 'info'
                            ? 'bg-primary/10 text-primary'
                            : item.level === 'important'
                              ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400'
                              : 'bg-red-500/12 text-red-600 dark:text-red-400',
                        )}
                      >
                        {style.label}
                      </span>
                    </div>

                    {item.content && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{item.content}</p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={12} aria-hidden />
                        {formatDateCN(item.startsAt ?? item.createdAt)}
                      </span>
                      {item.endsAt && <span>有效期至 {formatDateCN(item.endsAt)}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 通用单页                                                            */
/* ------------------------------------------------------------------ */

export function SinglePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, loading, error, reload } = usePage(slug)

  if (loading && !data) {
    return (
      <div className="container-theme py-20">
        <LoadingState label="正在加载页面…" minHeight={320} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container-theme py-20">
        <ErrorState message={error ?? '页面不存在或尚未发布'} onRetry={reload} />
        <div className="mt-2 text-center">
          <Link to="/" className="btn-ghost">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs items={[{ label: '首页', to: '/' }, { label: data.title }]} />

      <article className="mx-auto mt-6 max-w-3xl">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{data.title}</h1>
          {data.summary && <p className="mt-3 text-sm leading-relaxed text-muted">{data.summary}</p>}
        </header>
        <hr className="divider-theme my-7" />
        <Markdown source={data.content} />
      </article>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 404                                                                 */
/* ------------------------------------------------------------------ */

export function NotFoundPage() {
  return (
    <div className="container-theme flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <Megaphone className="text-muted opacity-40" size={44} aria-hidden />
      <h1 className="mt-5 text-5xl font-bold tracking-tight">404</h1>
      <p className="mt-3 text-muted">你访问的页面不存在，或者已被移除。</p>
      <div className="mt-7 flex gap-3">
        <Link to="/" className="btn-primary">
          返回首页
        </Link>
        <Link to="/articles" className="btn-ghost">
          浏览文章
        </Link>
      </div>
    </div>
  )
}
