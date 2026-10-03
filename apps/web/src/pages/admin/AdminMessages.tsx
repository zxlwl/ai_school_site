/**
 * 访客留言管理 — 查看前台提交的留言，标记已处理或删除。
 */

import { useState } from 'react';
import { Check, Mail, MessageSquare, Phone, Trash2, User } from 'lucide-react';
import type { ContactMessage, Paginated } from '@school/shared';
import { formatDateCN } from '@school/shared';
import { ApiError, adminApi } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, cn, toast } from '../../components/ui';

type Filter = 'all' | 'pending' | 'handled';

export default function AdminMessages() {
  const { data, loading, error, reload } = useAsync<Paginated<ContactMessage>>(
    () => adminApi.messages({ pageSize: 100 }),
    [],
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const messages = data?.items ?? [];
  const filtered = messages.filter((item) => {
    if (filter === 'pending') return !item.isHandled;
    if (filter === 'handled') return item.isHandled;
    return true;
  });

  const pendingCount = messages.filter((item) => !item.isHandled).length;

  const toggleHandled = async (message: ContactMessage) => {
    try {
      await adminApi.updateMessage(message.id, { isHandled: !message.isHandled });
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await adminApi.deleteMessage(confirmDelete.id);
      toast.success('留言已删除');
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const TABS: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: `全部 ${messages.length}` },
    { value: 'pending', label: `待处理 ${pendingCount}` },
    { value: 'handled', label: `已处理 ${messages.length - pendingCount}` },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">访客留言</h1>
        <p className="mt-1 text-sm text-muted">来自前台「联系我们」页面的留言</p>
      </header>

      <div className="mt-5 flex gap-1 rounded-theme border border-border p-1 sm:w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={cn(
              'flex-1 rounded-[calc(var(--c-radius)-2px)] px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
              filter === tab.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : filtered.length === 0 ? (
          <div className="card-theme">
            <EmptyState
              title={filter === 'pending' ? '没有待处理的留言' : '暂无留言'}
              description={
                filter === 'pending'
                  ? '所有留言都已处理完毕。'
                  : '访客在前台提交留言后，会显示在这里。'
              }
            />
          </div>
        ) : (
          filtered.map((message) => (
            <article
              key={message.id}
              className={cn('card-theme p-4', message.isHandled && 'opacity-70')}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-theme',
                    message.isHandled ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary',
                  )}
                  aria-hidden
                >
                  <MessageSquare size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="flex items-center gap-1.5 font-medium">
                      <User size={13} className="text-muted" aria-hidden />
                      {message.name}
                    </h2>
                    {message.isHandled && (
                      <span className="badge-theme bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                        已处理
                      </span>
                    )}
                  </div>

                  {message.subject && (
                    <p className="mt-1 text-sm font-medium text-muted">主题：{message.subject}</p>
                  )}

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-muted">
                    <span>{formatDateCN(message.createdAt)}</span>
                    {message.phone && (
                      <a href={`tel:${message.phone}`} className="flex items-center gap-1 hover:text-primary">
                        <Phone size={11} aria-hidden />
                        {message.phone}
                      </a>
                    )}
                    {message.email && (
                      <a href={`mailto:${message.email}`} className="flex items-center gap-1 hover:text-primary">
                        <Mail size={11} aria-hidden />
                        {message.email}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleHandled(message)}
                    className={cn(
                      'rounded p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                      message.isHandled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted',
                    )}
                    title={message.isHandled ? '标记为未处理' : '标记为已处理'}
                    aria-label={message.isHandled ? '标记为未处理' : '标记为已处理'}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(message)}
                    className="rounded p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="删除留言"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="删除留言"
        message={`确定要删除来自「${confirmDelete?.name ?? ''}」的留言吗？`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
