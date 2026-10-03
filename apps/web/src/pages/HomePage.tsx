/**
 * 首页 — 学校官网的门面。
 *
 * 结构：Hero 区 → 公告条 → 推荐文章 → 分类导航 → 最新文章 → 统计数据
 * 全部数据由 /api/public/home 一次返回，减少首屏往返次数。
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Megaphone, Sparkles } from 'lucide-react'
import { formatDateCN } from '@school/shared'
import { useHome } from '../lib/hooks'
import { ArticleCard } from '../components/ArticleCard'
import { ArticleCardSkeleton, EmptyState, ErrorState, Skeleton } from '../components/ui'

export function HomePage() {
  const { data, loading, error, reload } = useHome()

  if (loading && !data) return <HomeSkeleton />
  if (error && !data) return <div className="container-theme py-20"><ErrorState message={error} onRetry={reload} /></div>
  if (!data) return null

  const { settings, featured, latest, announcements, categories } = data

  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden border-b border-border">
        {/* 背景：主色的柔和径向渐变，不依赖任何图片资源 */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--c-primary) 22%, transparent), transparent 70%)`,
          }}
          aria-hidden
        />
        <div className="container-theme py-20 text-center md:py-28">
          <span
            className="badge-theme mb-5 inline-flex"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--c-primary) 12%, transparent)',
              color: 'var(--c-primary)',
            }}
          >
            <Sparkles size={12} aria-hidden />
            {settings.siteTagline || '欢迎访问'}
          </span>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {settings.siteName}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            {settings.siteDescription}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/articles" className="btn-primary !px-6 !py-2.5">
              浏览校园资讯
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/about" className="btn-ghost !px-6 !py-2.5">
              了解学校
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------- 公告栏 ---------------------------- */}
      {announcements.length > 0 && (
        <section className="border-b border-border bg-surface">
          <div className="container-theme py-4">
            <div className="flex items-start gap-3">
              <span
                className="badge-theme shrink-0"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--c-primary) 12%, transparent)',
                  color: 'var(--c-primary)',
                }}
              >
                <Megaphone size={12} aria-hidden />
                公告
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                {announcements.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    to="/announcements"
                    className="flex items-baseline gap-2 text-sm transition-colors hover:text-primary"
                  >
                    {item.level !== 'info' && (
                      <span
                        className={
                          item.level === 'urgent'
                            ? 'shrink-0 text-xs font-medium text-red-500'
                            : 'shrink-0 text-xs font-medium text-amber-500'
                        }
                      >
                        [{item.level === 'urgent' ? '紧急' : '重要'}]
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <time className="shrink-0 text-xs text-muted">
                      {formatDateCN(item.startsAt ?? item.createdAt)}
                    </time>
                  </Link>
                ))}
                {announcements.length > 3 && (
                  <Link to="/announcements" className="inline-flex items-center gap-1 pt-0.5 text-xs text-primary">
                    查看全部 {announcements.length} 条公告
                    <ArrowRight size={12} aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------- 推荐文章 --------------------------- */}
      {featured.length > 0 && (
        <section className="container-theme py-14">
          <SectionHeader title="推荐阅读" subtitle="精选校园动态与重要资讯" to="/articles" />
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 3).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* --------------------------- 分类导航 --------------------------- */}
      {categories.length > 0 && (
        <section className="border-y border-border bg-surface">
          <div className="container-theme py-14">
            <SectionHeader title="内容分类" subtitle="按主题查找你关心的内容" />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className="card-theme group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme text-lg font-semibold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${category.color ?? 'var(--c-primary)'} 14%, transparent)`,
                      color: category.color ?? 'var(--c-primary)',
                    }}
                    aria-hidden
                  >
                    {category.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      {category.name}
                      <ArrowRight
                        size={14}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>
                    {category.description && (
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{category.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{category.articleCount ?? 0} 篇</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------- 最新文章 --------------------------- */}
      <section className="container-theme py-14">
        <SectionHeader title="最新发布" subtitle="学校近期发生的事" to="/articles" />
        {latest.length === 0 ? (
          <EmptyState
            title="还没有发布任何文章"
            description="登录后台后即可发布第一篇文章。"
            action={
              <Link to="/admin" className="btn-primary mt-1">
                前往后台
              </Link>
            }
          />
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.slice(0, 6).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------- 联系区块 --------------------------- */}
      <section className="border-t border-border bg-surface">
        <div className="container-theme py-14">
          <div className="card-theme mx-auto max-w-3xl p-8 text-center">
            <Bell className="mx-auto text-primary" size={26} aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">需要了解更多？</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
              欢迎通过电话或邮件与我们联系，也欢迎到校参观。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/contact" className="btn-primary">
                联系我们
              </Link>
              {settings.contactPhone && (
                <a href={`tel:${settings.contactPhone}`} className="btn-ghost">
                  {settings.contactPhone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export function SectionHeader({
  title,
  subtitle,
  to,
  linkText = '查看全部',
}: {
  title: string
  subtitle?: string
  to?: string
  linkText?: string
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="group inline-flex shrink-0 items-center gap-1 text-sm text-primary">
          {linkText}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  )
}

function HomeSkeleton() {
  return (
    <>
      <section className="border-b border-border">
        <div className="container-theme py-24 text-center">
          <Skeleton className="mx-auto h-6 w-32" />
          <Skeleton className="mx-auto mt-6 h-11 w-2/3 max-w-xl" />
          <Skeleton className="mx-auto mt-5 h-5 w-1/2 max-w-md" />
          <div className="mt-8 flex justify-center gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </section>
      <section className="container-theme py-14">
        <Skeleton className="h-7 w-40" />
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <ArticleCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </>
  )
}
