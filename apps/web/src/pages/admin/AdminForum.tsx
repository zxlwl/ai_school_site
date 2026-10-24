/**
 * 后台 · 版块与主题管理。
 *
 * 两个标签页：版块（增删改）、主题（审核/置顶/锁定/隐藏）。
 * 只读角色能看到页面但所有写操作按钮都禁用 —— 后端也会拒绝，
 * 前端禁用只是避免用户白点一次。
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react'
import type { ForumBoard, ForumPostPolicy, ForumTopicStatus } from '@school/shared'
import { FORUM_POST_POLICY_LABEL, FORUM_POST_POLICIES, formatDateCN } from '@school/shared'
import { ApiError, adminForumApi, authApi, type AdminForumTopicRow } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import {
  Badge,
  Breadcrumbs,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  Pagination,
  Skeleton,
  Spinner,
  Switch,
  cn,
  toast,
} from '../../components/ui'

type Tab = 'boards' | 'topics'

export function AdminForum() {
  const [tab, setTab] = useState<Tab>('boards')
  const [canWrite, setCanWrite] = useState(true)

  // 只读角色：按钮整体禁用，避免无意义的失败请求
  useEffect(() => {
    authApi
      .session()
      .then((session) => {
        const role = session?.role ?? 'owner'
        setCanWrite(role === 'owner' || role === 'editor')
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: '后台', to: '/admin' }, { label: '论坛管理' }]} />

      <header>
        <h1 className="text-xl font-bold tracking-tight">论坛管理</h1>
        <p className="mt-1 text-sm text-muted">
          管理讨论版块与帖子。置顶帖会显示在版块列表最前。
        </p>
      </header>

      {!canWrite && (
        <div className="rounded-theme border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          当前账号为只读角色，只能查看，无法修改。
        </div>
      )}

      <div className="flex gap-1 rounded-theme border border-border bg-surface p-1 text-sm sm:inline-flex">
        {(
          [
            { value: 'boards', label: '版块' },
            { value: 'topics', label: '主题' },
          ] as const
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              'flex-1 rounded-[calc(var(--radius-theme)-4px)] px-4 py-1.5 text-[13px] font-medium transition-colors sm:flex-none',
              tab === item.value ? 'bg-primary/12 text-primary' : 'text-muted hover:text-fg',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'boards' ? <BoardsPanel canWrite={canWrite} /> : <TopicsPanel canWrite={canWrite} />}
    </div>
  )
}

/* ================================================================== */
/* 版块                                                                */
/* ================================================================== */

function BoardsPanel({ canWrite }: { canWrite: boolean }) {
  const { data, loading, error, reload } = useAsync(() => adminForumApi.boards(), [])
  const boards = data?.boards ?? []

  const [editing, setEditing] = useState<ForumBoard | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ForumBoard | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await adminForumApi.deleteBoard(deleting.id)
      toast.success('版块已删除')
      setDeleting(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <LoadingState label="正在加载版块…" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary"
          onClick={() => setCreating(true)}
          disabled={!canWrite}
        >
          <Plus size={15} aria-hidden />
          新建版块
        </button>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          title="还没有版块"
          description="创建第一个版块，让同学们开始讨论"
          action={
            canWrite ? (
              <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                新建版块
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card-theme divide-y divide-border">
          {boards.map((board) => (
            <div key={board.id} className="flex items-start gap-3 px-4 py-3.5">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-theme"
                style={{
                  backgroundColor: board.color
                    ? `color-mix(in srgb, ${board.color} 16%, transparent)`
                    : 'color-mix(in srgb, var(--c-primary) 12%, transparent)',
                  color: board.color || 'var(--c-primary)',
                }}
                aria-hidden
              >
                <MessageSquare size={16} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  <span className="truncate">{board.name}</span>
                  <span className="text-[11px] font-normal text-muted">/{board.slug}</span>
                  {board.archived && <Badge color="#6b7280">已归档</Badge>}
                  {board.needsReview && <Badge color="#f59e0b">需审核</Badge>}
                </p>
                {board.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">{board.description}</p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  <span>{board.topicCount ?? 0} 个主题</span>
                  <span>·</span>
                  <span>发帖权限：{FORUM_POST_POLICY_LABEL[board.postPolicy]}</span>
                  <span>·</span>
                  <span>排序 {board.sortOrder}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  to={`/forum/b/${board.slug}`}
                  target="_blank"
                  className="rounded p-1.5 text-muted transition-colors hover:text-primary"
                  title="前台查看"
                >
                  <Eye size={14} aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing(board)}
                  disabled={!canWrite}
                  className="rounded p-1.5 text-muted transition-colors hover:text-primary disabled:opacity-40"
                  title="编辑"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(board)}
                  disabled={!canWrite}
                  className="rounded p-1.5 text-muted transition-colors hover:text-red-500 disabled:opacity-40"
                  title="删除"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BoardEditModal
        open={creating || Boolean(editing)}
        board={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={() => {
          setCreating(false)
          setEditing(null)
          reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="删除版块"
        message={`确定删除版块「${deleting?.name ?? ''}」吗？版块下还有主题时无法删除。`}
        confirmText="删除"
        danger
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function BoardEditModal({
  open,
  board,
  onClose,
  onSaved,
}: {
  open: boolean
  board: ForumBoard | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [postPolicy, setPostPolicy] = useState<ForumPostPolicy>('member_only')
  const [needsReview, setNeedsReview] = useState(false)
  const [archived, setArchived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(board?.name ?? '')
    setSlug(board?.slug ?? '')
    setDescription(board?.description ?? '')
    setColor(board?.color ?? '')
    setSortOrder(String(board?.sortOrder ?? 0))
    setPostPolicy(board?.postPolicy ?? 'member_only')
    setNeedsReview(board?.needsReview ?? false)
    setArchived(board?.archived ?? false)
    setError('')
  }, [open, board])

  const save = async () => {
    setError('')
    if (!name.trim()) {
      setError('请填写版块名称')
      return
    }
    setSaving(true)
    try {
      if (board) {
        await adminForumApi.updateBoard(board.id, {
          name: name.trim(),
          description: description.trim() || null,
          color: color.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          postPolicy,
          needsReview,
          archived,
        })
        toast.success('版块已更新')
      } else {
        await adminForumApi.createBoard({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          color: color.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          postPolicy,
          needsReview,
        })
        toast.success('版块已创建')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={board ? '编辑版块' : '新建版块'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving && <Spinner />}
            保存
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="版块名称" required>
          <input
            className="input-theme"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="如：校园生活"
            maxLength={60}
          />
        </Field>

        {!board && (
          <Field label="标识（slug）" hint="留空自动按名称生成">
            <input
              className="input-theme"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="campus-life"
            />
          </Field>
        )}

        <Field label="简介">
          <textarea
            className="input-theme min-h-20 resize-y"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="一句话说明这个版块讨论什么"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="主题色" hint="留空用默认色">
            <div className="flex gap-2">
              <input
                className="input-theme flex-1"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#2563eb"
              />
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb'}
                onChange={(event) => setColor(event.target.value)}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-theme border border-border bg-transparent"
                aria-label="选择颜色"
              />
            </div>
          </Field>

          <Field label="排序" hint="数字越小越靠前">
            <input
              className="input-theme"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>

        <Field label="发帖权限">
          <select
            className="input-theme"
            value={postPolicy}
            onChange={(event) => setPostPolicy(event.target.value as ForumPostPolicy)}
          >
            {FORUM_POST_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {FORUM_POST_POLICY_LABEL[policy]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-3 rounded-theme border border-border p-3">
          <Switch
            checked={needsReview}
            onChange={setNeedsReview}
            label="新帖需要审核"
            description="开启后，会员发的主题要先经管理员审核才公开"
          />
          {board && (
            <Switch
              checked={archived}
              onChange={setArchived}
              label="归档版块"
              description="归档后前台不再显示，且不能发新帖"
            />
          )}
        </div>

        {error && (
          <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

/* ================================================================== */
/* 主题                                                                */
/* ================================================================== */

const STATUS_META: Record<ForumTopicStatus, { label: string; color: string }> = {
  published: { label: '已发布', color: '#10b981' },
  pending: { label: '待审核', color: '#f59e0b' },
  hidden: { label: '已隐藏', color: '#6b7280' },
  deleted: { label: '已删除', color: '#ef4444' },
}

function TopicsPanel({ canWrite }: { canWrite: boolean }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'' | ForumTopicStatus>('')

  const { data, loading, error, reload } = useAsync(
    () =>
      adminForumApi.topics({
        page,
        pageSize: 20,
        status: status || undefined,
      }),
    [page, status],
  )

  const topics = data?.topics ?? []
  const pagination = data?.pagination

  const patch = async (topic: AdminForumTopicRow, payload: Parameters<typeof adminForumApi.moderateTopic>[1]) => {
    try {
      await adminForumApi.moderateTopic(topic.id, payload)
      toast.success('已更新')
      reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input-theme w-auto text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as '' | ForumTopicStatus)
            setPage(1)
          }}
        >
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="pending">待审核</option>
          <option value="hidden">已隐藏</option>
        </select>
        <span className="text-xs text-muted">{pagination ? `共 ${pagination.total} 个主题` : ''}</span>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <EmptyState title="没有符合条件的主题" />
      ) : (
        <div className="card-theme divide-y divide-border">
          {topics.map((topic) => {
            const meta = STATUS_META[topic.status]
            return (
              <div key={topic.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    <Link
                      to={`/forum/t/${topic.slug}`}
                      target="_blank"
                      className="line-clamp-1 hover:text-primary"
                    >
                      {topic.title}
                    </Link>
                    <Badge color={meta.color}>{meta.label}</Badge>
                    {topic.pinned && <Badge color="#2563eb">置顶</Badge>}
                    {topic.locked && <Badge color="#6b7280">锁定</Badge>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                    <span>{topic.board.name}</span>
                    <span>·</span>
                    <span>{topic.author.displayName}</span>
                    <span>·</span>
                    <span>{formatDateCN(topic.createdAt)}</span>
                    <span>·</span>
                    <span>{topic.replyCount} 回复</span>
                    <span>·</span>
                    <span>{topic.views} 浏览</span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => patch(topic, { pinned: !topic.pinned })}
                    className="rounded p-1.5 text-muted transition-colors hover:text-primary disabled:opacity-40"
                    title={topic.pinned ? '取消置顶' : '置顶'}
                  >
                    {topic.pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => patch(topic, { locked: !topic.locked })}
                    className="rounded p-1.5 text-muted transition-colors hover:text-primary disabled:opacity-40"
                    title={topic.locked ? '解锁' : '锁定'}
                  >
                    {topic.locked ? <LockOpen size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
                  </button>
                  {topic.status === 'pending' && (
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => patch(topic, { status: 'published' })}
                      className="rounded p-1.5 text-muted transition-colors hover:text-emerald-600 disabled:opacity-40"
                      title="通过审核"
                    >
                      <Eye size={14} aria-hidden />
                    </button>
                  )}
                  {topic.status === 'published' && (
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => patch(topic, { status: 'hidden' })}
                      className="rounded p-1.5 text-muted transition-colors hover:text-amber-600 disabled:opacity-40"
                      title="隐藏"
                    >
                      <EyeOff size={14} aria-hidden />
                    </button>
                  )}
                  {topic.status === 'hidden' && (
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => patch(topic, { status: 'published' })}
                      className="rounded p-1.5 text-muted transition-colors hover:text-emerald-600 disabled:opacity-40"
                      title="恢复公开"
                    >
                      <Archive size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pagination && pagination.total > pagination.pageSize && (
        <Pagination
          page={pagination.page}
          totalPages={Math.ceil(pagination.total / pagination.pageSize)}
          onChange={setPage}
        />
      )}
    </div>
  )
}
