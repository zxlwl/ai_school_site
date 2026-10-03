/**
 * 后台仪表盘 — 数据总览与快捷入口。
 */

import { Link } from 'react-router-dom'
import {
  Eye,
  FileText,
  FolderTree,
  Megaphone,
  MessageSquare,
  Plus,
  TrendingUp,
} from 'lucide-react'
import type { DashboardStats } from '@school/shared'
import { formatDateCN } from '@school/shared'
import { adminApi } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { ErrorState, Skeleton, StatusBadge } from '../../components/ui'

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAsync<DashboardStats>(() => adminApi.stats(), [])

  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">仪表盘</h1>
          <p className="mt-1 text-sm text-muted">网站内容与访问情况一览</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/articles/new" className="btn-primary">
            <Plus size={15} aria-hidden />
            发布文章
          </Link>
        </div>
      </header>

      {/* 统计卡片 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="文章总数"
          value={data?.articles.total}
          sub={`${data?.articles.published ?? 0} 篇已发布 · ${data?.articles.draft ?? 0} 篇草稿`}
          icon={FileText}
          loading={loading}
          to="/admin/articles"
        />
        <StatCard
          label="累计浏览"
          value={data?.articles.views}
          sub="全部文章浏览量之和"
          icon={Eye}
          loading={loading}
          accent="emerald"
        />
        <StatCard
          label="公告数量"
          value={data?.announcements.total}
          sub={`${data?.announcements.published ?? 0} 条生效中`}
          icon={Megaphone}
          loading={loading}
          to="/admin/announcements"
          accent="amber"
        />
        <StatCard
          label="分类 / 留言"
          value={data?.categories}
          sub={`${data?.messages.pending ?? 0} 条留言待处理`}
          icon={FolderTree}
          loading={loading}
          to="/admin/messages"
          accent="violet"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* 最近文章 */}
        <section className="card-theme">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="font-semibold">最近发布</h2>
            <Link to="/admin/articles" className="text-sm text-primary">
              全部文章
            </Link>
          </header>

          {loading && !data ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.recentArticles.length ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted">还没有文章，先去发布一篇吧。</p>
              <Link to="/admin/articles/new" className="btn-primary mt-4">
                发布第一篇文章
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentArticles.map((article) => (
                <li key={article.id}>
                  <Link
                    to={`/admin/articles/${article.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--c-muted)_6%,transparent)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{article.title}</p>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                        <span>{article.categoryName ?? '未分类'}</span>
                        <span>{formatDateCN(article.publishedAt ?? article.createdAt)}</span>
                        <span className="flex items-center gap-1">
                          <Eye size={11} aria-hidden />
                          {article.views}
                        </span>
                      </p>
                    </div>
                    <StatusBadge published={article.status === 'published'} featured={article.featured} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 快捷入口 */}
        <aside className="grid gap-4 content-start">
          <section className="card-theme p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <TrendingUp size={16} className="text-primary" aria-hidden />
              快捷操作
            </h2>
            <ul className="mt-4 grid gap-1">
              {[
                { to: '/admin/articles/new', label: '发布新文章', icon: FileText },
                { to: '/admin/announcements', label: '发布公告', icon: Megaphone },
                { to: '/admin/categories', label: '管理分类', icon: FolderTree },
                { to: '/admin/messages', label: '查看留言', icon: MessageSquare },
                { to: '/admin/pages', label: '编辑单页', icon: FileText },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-2.5 rounded-theme px-3 py-2 text-sm text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--c-muted)_8%,transparent)] hover:text-fg"
                  >
                    <item.icon size={15} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-theme p-5">
            <h2 className="font-semibold">内容提示</h2>
            <ul className="mt-3 grid gap-2.5 text-xs leading-relaxed text-muted">
              <li>· 文章正文支持 Markdown 语法，标题会自动生成目录锚点。</li>
              <li>· 图片可直接粘贴或拖拽上传，默认内联存储无需额外配置。</li>
              <li>· 「外观主题」中的改动立即生效，前台无需重新部署。</li>
              <li>· 定期导出文章内容，避免数据只存在单一数据库中。</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
  to,
  accent = 'primary',
}: {
  label: string
  value: number | string | undefined
  sub?: string
  icon: typeof FileText
  loading?: boolean
  to?: string
  accent?: 'primary' | 'emerald' | 'amber' | 'violet'
}) {
  const accentColor =
    accent === 'emerald'
      ? 'text-emerald-600 bg-emerald-500/12 dark:text-emerald-400'
      : accent === 'amber'
        ? 'text-amber-600 bg-amber-500/12 dark:text-amber-400'
        : accent === 'violet'
          ? 'text-violet-600 bg-violet-500/12 dark:text-violet-400'
          : 'text-primary bg-primary/10'

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-theme ${accentColor}`} aria-hidden>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">
        {loading ? <Skeleton className="h-8 w-16" /> : (value ?? 0)}
      </p>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </>
  )

  return to ? (
    <Link to={to} className="card-theme p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      {content}
    </Link>
  ) : (
    <div className="card-theme p-5">{content}</div>
  )
}
