/**
 * 文章卡片 — 列表页与首页复用的核心展示单元。
 */

import { Link } from 'react-router-dom'
import { CalendarDays, Eye, Pin } from 'lucide-react'
import type { Article } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { cn } from './ui'

/** 无封面图时用标题首字生成一个色块，避免列表出现空洞 */
function PlaceholderCover({ title, seed }: { title: string; seed: number }) {
  const palettes = [
    'linear-gradient(135deg, #2563eb, #0ea5e9)',
    'linear-gradient(135deg, #059669, #34d399)',
    'linear-gradient(135deg, #7c3aed, #a78bfa)',
    'linear-gradient(135deg, #dc2626, #f87171)',
    'linear-gradient(135deg, #d97706, #fbbf24)',
    'linear-gradient(135deg, #0891b2, #22d3ee)',
  ]
  const background = palettes[seed % palettes.length]

  return (
    <div
      className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/95"
      style={{ background }}
      aria-hidden
    >
      {title.slice(0, 1)}
    </div>
  )
}

export function ArticleCard({ article, layout = 'grid' }: { article: Article; layout?: 'grid' | 'list' }) {
  const isList = layout === 'list'

  return (
    <article
      className={cn(
        'card-theme group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        isList && 'flex flex-col sm:flex-row',
      )}
    >
      <Link
        to={`/article/${article.slug}`}
        className={cn('block shrink-0 overflow-hidden bg-[color-mix(in_srgb,var(--c-muted)_8%,transparent)]', isList ? 'h-44 sm:h-auto sm:w-56' : 'h-44')}
        aria-hidden={false}
        tabIndex={-1}
      >
        {article.coverImage ? (
          <img
            src={article.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PlaceholderCover title={article.title} seed={article.id} />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {article.category && (
            <Link
              to={`/category/${article.category.slug}`}
              className="badge-theme transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `color-mix(in srgb, ${article.category.color ?? 'var(--c-primary)'} 14%, transparent)`,
                color: article.category.color ?? 'var(--c-primary)',
              }}
            >
              {article.category.name}
            </Link>
          )}
          {article.featured && (
            <span className="badge-theme bg-red-500/12 text-red-600 dark:text-red-400">
              <Pin size={11} aria-hidden /> 推荐
            </span>
          )}
        </div>

        <h3 className={cn('mt-2 font-semibold leading-snug', isList ? 'text-base' : 'text-[15px]')}>
          <Link to={`/article/${article.slug}`} className="transition-colors hover:text-primary line-clamp-2">
            {article.title}
          </Link>
        </h3>

        {article.excerpt && (
          <p className={cn('mt-2 text-sm leading-relaxed text-muted', isList ? 'line-clamp-3' : 'line-clamp-2')}>
            {article.excerpt}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <CalendarDays size={13} aria-hidden />
            {formatDateCN(article.publishedAt ?? article.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={13} aria-hidden />
            {article.views}
          </span>
          {article.author && <span className="truncate">{article.author}</span>}
        </div>
      </div>
    </article>
  )
}

export function ArticleCardGrid({ articles, layout }: { articles: Article[]; layout?: 'grid' | 'list' }) {
  if (layout === 'list') {
    return (
      <div className="grid gap-4">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} layout="list" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}
