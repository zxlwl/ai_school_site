/**
 * 文章详情页 — 正文渲染 + 目录 + 相关阅读 + 上下篇。
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ChevronRight, Clock, Eye, List, Share2, User } from 'lucide-react'
import { formatDateCN } from '@school/shared'
import { useArticle } from '../lib/hooks'
import { Markdown, extractToc } from '../components/markdown'
import { Badge, Breadcrumbs, ErrorState, LoadingState, toast } from '../components/ui'
import { cn } from '../components/ui'

/** 粗略估算中文阅读时长：按 350 字/分钟 */
function readingMinutes(content: string): number {
  const plain = content.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, '')
  return Math.max(1, Math.round(plain.length / 350))
}

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: article, loading, error, reload } = useArticle(slug)
  const [activeId, setActiveId] = useState<string>('')

  const toc = useMemo(() => (article ? extractToc(article.content) : []), [article])

  // 滚动时高亮当前所在章节
  useEffect(() => {
    if (toc.length === 0) return
    const headings = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [toc, article?.id])

  // 动态页面标题，利于分享与搜索引擎收录
  useEffect(() => {
    if (article) document.title = `${article.title} — ${article.category?.name ?? '文章'}`
    return () => {
      // 离开时恢复站点名由 SiteLayout 的 settings 负责
    }
  }, [article])

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: article?.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制到剪贴板')
    } catch {
      // 用户取消分享或浏览器不支持剪贴板，无需打扰
    }
  }

  if (loading && !article) {
    return (
      <div className="container-theme py-20">
        <LoadingState label="正在加载文章…" minHeight={320} />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="container-theme py-20">
        <ErrorState message={error ?? '文章不存在或已被删除'} onRetry={reload} />
        <div className="mt-2 text-center">
          <Link to="/articles" className="btn-ghost">
            <ArrowLeft size={15} aria-hidden />
            返回文章列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: '首页', to: '/' },
          { label: '文章', to: '/articles' },
          ...(article.category ? [{ label: article.category.name, to: `/category/${article.category.slug}` }] : []),
          { label: article.title.length > 24 ? `${article.title.slice(0, 24)}…` : article.title },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="min-w-0">
          <header>
            <h1 className="text-2xl font-bold leading-snug tracking-tight md:text-[2rem]">{article.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              {article.category && (
                <Link to={`/category/${article.category.slug}`}>
                  <Badge color={article.category.color}>{article.category.name}</Badge>
                </Link>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden />
                {formatDateCN(article.publishedAt ?? article.createdAt)}
              </span>
              {article.author && (
                <span className="flex items-center gap-1.5">
                  <User size={14} aria-hidden />
                  {article.author}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock size={14} aria-hidden />
                约 {readingMinutes(article.content)} 分钟
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={14} aria-hidden />
                {article.views} 次浏览
              </span>
              <button
                type="button"
                onClick={handleShare}
                className="ml-auto flex items-center gap-1.5 transition-colors hover:text-primary"
              >
                <Share2 size={14} aria-hidden />
                分享
              </button>
            </div>
          </header>

          <hr className="divider-theme my-7" />

          {article.coverImage && (
            <img
              src={article.coverImage}
              alt={article.title}
              className="mb-8 w-full rounded-theme object-cover"
              style={{ maxHeight: '26rem' }}
            />
          )}

          <Markdown source={article.content} />

          {/* 相关阅读 */}
          {article.related && article.related.length > 0 && (
            <section className="mt-14 border-t border-border pt-8">
              <h2 className="text-lg font-semibold">相关阅读</h2>
              <ul className="mt-4 grid gap-2.5">
                {article.related.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/article/${item.slug}`}
                      className="group flex items-baseline gap-3 rounded-theme px-3 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--c-muted)_8%,transparent)]"
                    >
                      <ChevronRight
                        size={15}
                        className="mt-0.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-sm">{item.title}</span>
                      <time className="shrink-0 text-xs text-muted">{formatDateCN(item.publishedAt)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-10">
            <Link to="/articles" className="btn-ghost">
              <ArrowLeft size={15} aria-hidden />
              返回文章列表
            </Link>
          </div>
        </article>

        {/* 侧边目录：移动端隐藏 */}
        {toc.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <List size={13} aria-hidden />
                本文目录
              </h2>
              <nav className="mt-3 border-l border-border" aria-label="文章目录">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={cn(
                      'block border-l-2 py-1.5 text-[13px] leading-snug transition-colors',
                      item.level === 3 ? 'pl-6' : 'pl-3',
                      activeId === item.id
                        ? 'border-primary font-medium text-primary'
                        : 'border-transparent text-muted hover:border-border hover:text-fg',
                    )}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
