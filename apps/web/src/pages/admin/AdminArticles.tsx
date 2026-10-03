/**
 * 后台文章列表 — 搜索、筛选、批量删除。
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { formatDateCN } from '@school/shared'
import { ApiError, adminApi } from '../../lib/api'
import type { AdminArticle } from '../../lib/api'
import { useAdminArticles, useCategories, useDebounced } from '../../lib/hooks'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Pagination,
  Spinner,
  StatusBadge,
  cn,
  toast,
} from '../../components/ui'

const PAGE_SIZE = 15

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
]

export default function AdminArticles() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 400)

  const [selected, setSelected] = useState<number[]>([])
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[]; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, loading, error, reload } = useAdminArticles(page, PAGE_SIZE, status, search)

  const articles: AdminArticle[] = data?.items ?? []
  const allSelected = articles.length > 0 && articles.every((item) => selected.includes(item.id))

  const toggleAll = () => {
    setSelected(allSelected ? [] : articles.map((item) => item.id))
  }

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      if (confirmDelete.ids.length === 1) {
        await adminApi.deleteArticle(confirmDelete.ids[0])
      } else {
        await adminApi.batchDeleteArticles(confirmDelete.ids)
      }
      toast.success(`已删除 ${confirmDelete.ids.length} 篇文章`)
      setSelected([])
      setConfirmDelete(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  /** 一键切换推荐（featured 同时决定列表是否排在最前） */
  const quickToggle = async (article: AdminArticle) => {
    try {
      await adminApi.updateArticle(article.id, { featured: !article.featured })
      toast.success(article.featured ? '已取消推荐' : '已设为推荐')
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败')
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">文章管理</h1>
          <p className="mt-1 text-sm text-muted">共 {data?.total ?? 0} 篇文章</p>
        </div>
        <Link to="/admin/articles/new" className="btn-primary">
          <Plus size={15} aria-hidden />
          新建文章
        </Link>
      </header>

      {/* 工具栏 */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-theme border border-border p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
                setSelected([])
              }}
              className={cn(
                'rounded-[calc(var(--c-radius)-2px)] px-3 py-1.5 text-sm font-medium transition-colors',
                status === tab.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            className="input-theme !pl-9 !pr-9"
            placeholder="搜索标题或内容…"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPage(1)
            }}
            aria-label="搜索文章"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              aria-label="清空搜索"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 批量操作条 */}
      {selected.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-theme border border-primary/25 bg-primary/6 px-4 py-2.5 text-sm">
          <span>已选中 {selected.length} 项</span>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 text-red-600 transition-opacity hover:opacity-80 dark:text-red-400"
            onClick={() =>
              setConfirmDelete({ ids: selected, title: `选中的 ${selected.length} 篇文章` })
            }
          >
            <Trash2 size={14} aria-hidden />
            批量删除
          </button>
          <button type="button" className="text-muted hover:text-fg" onClick={() => setSelected([])}>
            取消选择
          </button>
        </div>
      )}

      {/* 列表 */}
      <div className="card-theme mt-4 overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && articles.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="text-primary" />
          </div>
        ) : articles.length === 0 ? (
          <EmptyState
            title={search ? '没有匹配的文章' : '还没有文章'}
            description={search ? '试试其他关键词。' : '发布第一篇文章，让网站有内容可看。'}
            action={
              search ? (
                <button type="button" className="btn-ghost mt-1" onClick={() => setSearchInput('')}>
                  清空搜索
                </button>
              ) : (
                <Link to="/admin/articles/new" className="btn-primary mt-1">
                  新建文章
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border bg-[color-mix(in_srgb,var(--c-muted)_5%,transparent)] text-left text-xs text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="全选"
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--c-primary)]"
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">标题</th>
                  <th className="w-24 px-3 py-3 font-medium">分类</th>
                  <th className="w-28 px-3 py-3 font-medium">状态</th>
                  <th className="w-20 px-3 py-3 font-medium">浏览</th>
                  <th className="w-28 px-3 py-3 font-medium">更新时间</th>
                  <th className="w-32 px-3 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {articles.map((article) => (
                  <tr
                    key={article.id}
                    className={cn(
                      'transition-colors hover:bg-[color-mix(in_srgb,var(--c-muted)_4%,transparent)]',
                      selected.includes(article.id) && 'bg-primary/5',
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(article.id)}
                        onChange={() => toggleOne(article.id)}
                        aria-label={`选择「${article.title}」`}
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--c-primary)]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to={`/admin/articles/${article.id}`}
                        className="line-clamp-1 font-medium transition-colors hover:text-primary"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                        /{article.slug}
                        {article.author && ` · ${article.author}`}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {article.category ? (
                        <span
                          className="badge-theme"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${article.category.color ?? 'var(--c-primary)'} 14%, transparent)`,
                            color: article.category.color ?? 'var(--c-primary)',
                          }}
                        >
                          {article.category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">未分类</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge published={article.status === 'published'} />
                    </td>
                    <td className="px-3 py-3 text-muted">{article.views}</td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {formatDateCN(article.updatedAt ?? article.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => quickToggle(article)}
                          className={cn(
                            'rounded p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                            article.featured ? 'text-amber-500' : 'text-muted',
                          )}
                          title={article.featured ? '取消推荐' : '设为推荐'}
                          aria-label={article.featured ? '取消推荐' : '设为推荐'}
                        >
                          <Star size={14} />
                        </button>
                        {article.status === 'published' && (
                          <Link
                            to={`/article/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                            title="前台查看"
                            aria-label="前台查看"
                          >
                            <Eye size={14} />
                          </Link>
                        )}
                        <Link
                          to={`/admin/articles/${article.id}`}
                          className="rounded p-1.5 text-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                          title="编辑"
                          aria-label="编辑"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ ids: [article.id], title: article.title })}
                          className="rounded p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                          title="删除"
                          aria-label="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          onChange={(next) => {
            setPage(next)
            setSelected([])
          }}
          className="mt-6"
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="删除文章"
        message={`确定要删除「${confirmDelete?.title ?? ''}」吗？该操作不可撤销，文章的浏览记录也会一并移除。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
