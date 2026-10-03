/**
 * 文章列表 / 分类列表 / 搜索 三合一页面。
 *
 * 同样的列表逻辑在三个路由下复用，只换标题与数据来源，避免三份重复代码。
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Search as SearchIcon, X } from 'lucide-react'
import type { ArticleQuery } from '@school/shared'
import { useArticles, useCategories, useDebounced } from '../lib/hooks'
import { ArticleCardGrid } from '../components/ArticleCard'
import { Breadcrumbs, EmptyState, ErrorState, Pagination, Spinner, cn } from '../components/ui'

const PAGE_SIZE = 9

const SORT_OPTIONS: Array<{ value: NonNullable<ArticleQuery['sort']>; label: string }> = [
  { value: 'latest', label: '最新发布' },
  { value: 'oldest', label: '最早发布' },
  { value: 'popular', label: '最多浏览' },
  { value: 'title', label: '标题排序' },
]

export function ArticleListPage({ mode = 'all' }: { mode?: 'all' | 'category' | 'search' }) {
  const params = useParams<{ slug?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const sort = (searchParams.get('sort') ?? 'latest') as NonNullable<ArticleQuery['sort']>
  const layout = (searchParams.get('view') ?? 'grid') as 'grid' | 'list'

  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const debouncedSearch = useDebounced(searchInput, 400)

  const categoriesState = useCategories()
  const category = mode === 'category' ? categoriesState.data?.find((item) => item.slug === params.slug) : undefined

  // 搜索模式下把防抖后的关键词同步到 URL，让结果可分享、可回退
  useEffect(() => {
    if (mode !== 'search') return
    const next = new URLSearchParams(searchParams)
    if (debouncedSearch) next.set('q', debouncedSearch)
    else next.delete('q')
    if (next.toString() !== searchParams.toString()) {
      next.delete('page')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mode])

  const query = useMemo<ArticleQuery>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      sort,
      category: mode === 'category' ? params.slug : undefined,
      search: mode === 'search' ? debouncedSearch || undefined : undefined,
    }),
    [page, sort, mode, params.slug, debouncedSearch],
  )

  const { data, loading, error, reload } = useArticles(query)

  // 切换筛选条件时回到第一页
  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const title =
    mode === 'category' ? category?.name ?? '分类' : mode === 'search' ? '搜索文章' : '全部文章'
  const description =
    mode === 'category'
      ? category?.description ?? '该分类下的全部内容'
      : mode === 'search'
        ? '输入关键词查找你需要的文章'
        : '校园新闻、通知公告、教学科研与师生风采'

  const articles = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: '首页', to: '/' },
          ...(mode === 'category' && category ? [{ label: '文章', to: '/articles' }, { label: category.name }] : []),
          ...(mode === 'category' && !category ? [{ label: '文章', to: '/articles' }] : []),
          ...(mode === 'search' ? [{ label: '搜索' }] : []),
          ...(mode === 'all' ? [{ label: '全部文章' }] : []),
        ]}
      />

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </header>

      {/* 工具栏：搜索 + 排序 + 视图切换 */}
      <div className="mt-6 flex flex-col gap-3 border-y border-border py-3.5 sm:flex-row sm:items-center">
        {mode === 'search' && (
          <div className="relative flex-1 sm:max-w-xs">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索文章标题或内容…"
              className="input-theme !pl-9 !pr-9"
              autoFocus
              aria-label="搜索关键词"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-fg"
                aria-label="清空搜索"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 sm:ml-auto">
          {loading && <Spinner className="text-muted" />}
          <span className="hidden text-xs text-muted sm:inline">共 {total} 篇</span>

          <select
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value)}
            className="input-theme !w-auto !py-1.5 text-xs"
            aria-label="排序方式"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-theme border border-border">
            <button
              type="button"
              onClick={() => updateParam('view', 'grid')}
              className={cn('px-2.5 py-1.5 transition-colors', layout === 'grid' ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg')}
              aria-label="网格视图"
              aria-pressed={layout === 'grid'}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => updateParam('view', 'list')}
              className={cn('px-2.5 py-1.5 transition-colors', layout === 'list' ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg')}
              aria-label="列表视图"
              aria-pressed={layout === 'list'}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 分类快捷筛选 */}
      {categoriesState.data && categoriesState.data.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/articles"
            className={cn(
              'badge-theme border transition-colors',
              mode === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-fg',
            )}
          >
            全部
          </Link>
          {categoriesState.data.map((item) => (
            <Link
              key={item.id}
              to={`/category/${item.slug}`}
              className={cn(
                'badge-theme border transition-colors',
                category?.id === item.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted hover:text-fg',
              )}
            >
              {item.name}
              <span className="opacity-60">{item.articleCount ?? 0}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 内容区 */}
      <div className="mt-7">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && articles.length === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="card-theme h-72 animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState
            title={mode === 'search' ? '没有找到匹配的文章' : '该分类下暂无文章'}
            description={
              mode === 'search'
                ? '试试更换关键词，或者浏览全部分类。'
                : '换个分类看看，或者稍后再来。'
            }
            action={
              <Link to="/articles" className="btn-ghost mt-1">
                浏览全部文章
              </Link>
            }
          />
        ) : (
          <>
            <ArticleCardGrid articles={articles} layout={layout} />
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={(next) => updateParam('page', String(next))}
              className="mt-10"
            />
          </>
        )}
      </div>
    </div>
  )
}
