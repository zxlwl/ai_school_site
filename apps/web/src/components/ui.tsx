/**
 * 通用 UI 组件与工具。
 */

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { formatDateCN } from '@school/shared'

/* ------------------------------------------------------------------ */
/* className 合并                                                      */
/* ------------------------------------------------------------------ */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ */
/* 加载 / 错误 / 空态                                                  */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} size={18} aria-hidden />
}

export function LoadingState({ label = '加载中…', minHeight = 200 }: { label?: string; minHeight?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 text-muted"
      style={{ minHeight }}
      role="status"
      aria-live="polite"
    >
      <Spinner className="text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  compact,
}: {
  message: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'py-6' : 'py-14',
      )}
      role="alert"
    >
      <AlertCircle className="text-red-500" size={compact ? 22 : 30} aria-hidden />
      <p className="text-sm text-muted max-w-md">{message}</p>
      {onRetry && (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          重新加载
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title = '暂无内容',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="text-4xl opacity-25" aria-hidden>
        📭
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted max-w-md">{description}</p>}
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 面包屑                                                              */
/* ------------------------------------------------------------------ */

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="面包屑导航" className="flex items-center flex-wrap gap-1.5 text-sm text-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight size={14} className="opacity-50" aria-hidden />}
          {item.to ? (
            <Link to={item.to} className="hover:text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* 分页                                                                */
/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}) {
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages])
  if (totalPages <= 1) return null

  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="分页">
      <button
        type="button"
        className="btn-ghost !px-2.5"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="上一页"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="px-1.5 text-muted select-none">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'min-w-9 h-9 px-2.5 rounded-theme text-sm font-medium transition-colors',
              item === page
                ? 'bg-primary text-primary-fg'
                : 'border border-border hover:bg-[color-mix(in_srgb,var(--c-muted)_10%,transparent)]',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className="btn-ghost !px-2.5"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="下一页"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

function buildPageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: Array<number | '…'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('…')
  for (let i = start; i <= end; i += 1) items.push(i)
  if (end < total - 1) items.push('…')
  items.push(total)
  return items
}

/* ------------------------------------------------------------------ */
/* 模态框                                                              */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn('card-theme w-full shadow-2xl animate-fade-in-up', width)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted transition-colors hover:text-fg"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 确认对话框                                                          */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmText = '确认',
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width="max-w-md"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button
            type="button"
            className={cn('btn-primary', danger && '!bg-red-600')}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner />}
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted leading-relaxed">{message}</p>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 操作提示条（Toast）                                                 */
/* ------------------------------------------------------------------ */

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'info'
  text: string
}

let toastSeq = 0
const toastListeners = new Set<(toasts: ToastMessage[]) => void>()
let toasts: ToastMessage[] = []

function emitToasts() {
  for (const listener of toastListeners) listener([...toasts])
}

export const toast = {
  show(text: string, type: ToastMessage['type'] = 'info', duration = 3200) {
    const item: ToastMessage = { id: (toastSeq += 1), type, text }
    toasts = [...toasts, item]
    emitToasts()
    setTimeout(() => toast.dismiss(item.id), duration)
    return item.id
  },
  success: (text: string) => toast.show(text, 'success'),
  error: (text: string) => toast.show(text, 'error', 4800),
  info: (text: string) => toast.show(text, 'info'),
  dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id)
    emitToasts()
  },
}

export function ToastHost() {
  const [list, setList] = useState<ToastMessage[]>([])

  useEffect(() => {
    toastListeners.add(setList)
    setList([...toasts])
    return () => {
      toastListeners.delete(setList)
    }
  }, [])

  if (list.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2">
      {list.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-theme border px-4 py-3 text-sm shadow-lg backdrop-blur animate-fade-in-up',
            item.type === 'success' && 'border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
            item.type === 'error' && 'border-red-500/30 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
            item.type === 'info' && 'border-border bg-surface text-fg',
          )}
        >
          <span className="flex-1 leading-relaxed">{item.text}</span>
          <button
            type="button"
            onClick={() => toast.dismiss(item.id)}
            className="mt-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="关闭提示"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 标签 / 徽章                                                         */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  color,
  tone = 'soft',
}: {
  children: ReactNode
  color?: string | null
  tone?: 'soft' | 'solid'
}) {
  const base = color ?? 'var(--c-primary)'
  return (
    <span
      className="badge-theme"
      style={
        tone === 'solid'
          ? { backgroundColor: base, color: '#fff' }
          : {
              backgroundColor: `color-mix(in srgb, ${base} 14%, transparent)`,
              color: base,
            }
      }
    >
      {children}
    </span>
  )
}

export function StatusBadge({ published, featured, pinned }: { published: boolean; featured?: boolean; pinned?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          'badge-theme',
          published
            ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        )}
      >
        {published ? '已发布' : '草稿'}
      </span>
      {featured && <span className="badge-theme bg-primary/12 text-primary">推荐</span>}
      {pinned && <span className="badge-theme bg-red-500/12 text-red-600 dark:text-red-400">置顶</span>}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 日期                                                                */
/* ------------------------------------------------------------------ */

export function DateText({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className={cn('text-muted', className)}>—</span>
  return (
    <time dateTime={value} className={className}>
      {formatDateCN(value)}
    </time>
  )
}

/* ------------------------------------------------------------------ */
/* 输入控件                                                            */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-auto text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-[color-mix(in_srgb,var(--c-muted)_35%,transparent)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}

export function ColorInput({
  value,
  onChange,
  label,
  hint,
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  hint?: string
}) {
  return (
    <div className="grid gap-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-11 cursor-pointer rounded border border-border bg-transparent p-0.5"
          aria-label={label ?? '选择颜色'}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-theme font-mono text-xs"
          spellCheck={false}
        />
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 骨架屏                                                              */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-theme bg-[color-mix(in_srgb,var(--c-muted)_14%,transparent)]', className)}
      aria-hidden
    />
  )
}

export function ArticleCardSkeleton() {
  return (
    <div className="card-theme overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
