/**
 * API 客户端 — 统一处理请求、错误与凭证。
 *
 * 关键设计：
 * - 基址默认为同源的 /api。前端与 API 分开部署时通过 VITE_API_BASE 覆盖。
 * - credentials: 'include' 让浏览器带上 httpOnly 会话 Cookie。
 * - 401 统一抛出 UnauthorizedError，由后台路由捕获后跳转登录页。
 */

const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = '登录已过期，请重新登录') {
    super(401, 'unauthorized', message)
    this.name = 'UnauthorizedError'
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { raw?: boolean } = {},
): Promise<T> {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`

  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch {
    // 网络层失败（断网、API 未启动）
    throw new ApiError(0, 'network_error', '无法连接到服务器，请检查网络或 API 是否已启动')
  }

  if (init.raw) return response as unknown as T

  // 204 或空响应体
  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const body = payload as { error?: string; message?: string; details?: unknown } | null
    if (response.status === 401) {
      throw new UnauthorizedError(body?.message)
    }
    throw new ApiError(
      response.status,
      body?.error ?? 'request_failed',
      body?.message ?? `请求失败（HTTP ${response.status}）`,
      body?.details,
    )
  }

  // 后端统一返回 { data: ... }
  const wrapped = payload as { data?: T } | null
  return (wrapped && typeof wrapped === 'object' && 'data' in wrapped ? wrapped.data : payload) as T
}

/* ------------------------------------------------------------------ */
/* 通用方法                                                            */
/* ------------------------------------------------------------------ */

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** 上传图片：data 为 base64 字符串（不含 data: 前缀） */
  upload: <T>(payload: { filename: string; mimeType: string; data: string }) =>
    request<T>('/upload', { method: 'POST', body: JSON.stringify(payload) }),
}

/* ------------------------------------------------------------------ */
/* 类型化接口                                                          */
/* ------------------------------------------------------------------ */

import type {
  AdminAccount,
  AdminAccountInput,
  Announcement,
  AnnouncementInput,
  Article,
  ArticleInput,
  ArticleQuery,
  Category,
  CategoryInput,
  ContactMessage,
  DashboardStats,
  LoginResponse,
  Page,
  PageInput,
  Paginated,
  RegisterRequest,
  SessionInfo,
  SiteSettings,
  UpdateProfileInput,
  UserLoginRequest,
  UserProfile,
  UserSessionInfo,
  ForumBoard,
  ForumBoardInput,
  ForumPost,
  ForumPostPolicy,
  ForumTopic,
  ForumTopicInput,
  ForumTopicStatus,
  ForumTopicSummary,
} from '@school/shared'

function toQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const str = search.toString()
  return str ? `?${str}` : ''
}

/* ---------------------------- 公开接口 ---------------------------- */

export const publicApi = {
  home: () =>
    api.get<{
      settings: SiteSettings
      featured: Article[]
      latest: Article[]
      announcements: Announcement[]
      categories: Category[]
    }>('/public/home'),

  settings: () => api.get<SiteSettings>('/public/settings'),

  navigation: () =>
    api.get<{
      categories: Category[]
      pages: Array<{ id: number; title: string; slug: string; sortOrder: number }>
      siteName: string
    }>('/public/navigation'),

  categories: () => api.get<Category[]>('/public/categories'),

  articles: (query?: ArticleQuery) =>
    api.get<Paginated<Article>>(`/public/articles${toQuery(query as Record<string, unknown>)}`),

  article: (slug: string) =>
    api.get<ArticleDetail>(`/public/articles/${encodeURIComponent(slug)}`),

  announcements: (limit?: number) =>
    api.get<Announcement[]>(`/public/announcements${limit ? `?limit=${limit}` : ''}`),

  page: (slug: string) => api.get<Page>(`/public/pages/${encodeURIComponent(slug)}`),

  submitMessage: (payload: {
    name: string
    content: string
    email?: string
    phone?: string
    subject?: string
  }) => api.post<{ ok: true }>('/public/messages', payload),
}

/* ---------------------------- 认证接口 ---------------------------- */

export const authApi = {
  login: (password: string, username?: string) =>
    api.post<LoginResponse>('/auth/login', { password, username }),

  logout: () => api.post<{ ok: true }>('/auth/logout'),

  session: () => api.get<SessionInfo & { username?: string }>('/auth/session'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: true }>('/auth/change-password', { currentPassword, newPassword }),
}

/* ---------------------------- 会员账号 ---------------------------- */

export const accountApi = {
  register: (payload: RegisterRequest) =>
    api.post<{ user: UserProfile }>('/account/register', payload),

  login: (payload: UserLoginRequest) => api.post<{ user: UserProfile }>('/account/login', payload),

  logout: () => api.post<{ ok: true }>('/account/logout'),

  session: () => api.get<UserSessionInfo>('/account/session'),

  updateProfile: (payload: UpdateProfileInput) =>
    api.put<{ user: UserProfile }>('/account/profile', payload),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: true }>('/account/change-password', { currentPassword, newPassword }),
}

/* ---------------------------- 管理员账号 -------------------------- */

export const adminAccountApi = {
  list: () => api.get<AdminAccount[]>('/admin/accounts'),
  create: (payload: AdminAccountInput) => api.post<AdminAccount>('/admin/accounts', payload),
  update: (id: number, payload: AdminAccountInput) =>
    api.put<AdminAccount>(`/admin/accounts/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: true }>(`/admin/accounts/${id}`),
  forcePasswordChange: (id: number) =>
    api.post<AdminAccount>(`/admin/accounts/${id}/force-password-change`),
}

/* ---------------------------- 后台接口 ---------------------------- */

/** 文章详情：正文之外还附带同分类的「相关阅读」 */
export type ArticleDetail = Article & {
  related: Array<{ id: number; title: string; slug: string; publishedAt: string | null }>
}

/** 后台列表项：正文可能省略，以减小响应体积 */
export type AdminArticle = Omit<Article, 'content'> & { content?: string }

export const adminApi = {
  stats: () => api.get<DashboardStats>('/admin/stats'),

  /* 文章 */
  articles: (query?: {
    page?: number
    pageSize?: number
    status?: string
    category?: number
    search?: string
  }) => api.get<Paginated<AdminArticle>>(`/admin/articles${toQuery(query)}`),

  article: (id: number) => api.get<Article>(`/admin/articles/${id}`),
  createArticle: (payload: ArticleInput) => api.post<{ id: number }>('/admin/articles', payload),
  updateArticle: (id: number, payload: Partial<ArticleInput>) =>
    api.put<{ ok: true }>(`/admin/articles/${id}`, payload),
  deleteArticle: (id: number) => api.delete<{ ok: true }>(`/admin/articles/${id}`),
  batchDeleteArticles: (ids: number[]) =>
    api.post<{ ok: true; deleted: number }>('/admin/articles/batch-delete', { ids }),

  /* 分类 */
  categories: () => api.get<Category[]>('/admin/categories'),
  createCategory: (payload: CategoryInput) => api.post<{ id: number }>('/admin/categories', payload),
  updateCategory: (id: number, payload: Partial<CategoryInput>) =>
    api.put<{ ok: true }>(`/admin/categories/${id}`, payload),
  deleteCategory: (id: number) => api.delete<{ ok: true }>(`/admin/categories/${id}`),

  /* 公告 */
  announcements: () => api.get<Announcement[]>('/admin/announcements'),
  createAnnouncement: (payload: AnnouncementInput) =>
    api.post<{ id: number }>('/admin/announcements', payload),
  updateAnnouncement: (id: number, payload: Partial<AnnouncementInput>) =>
    api.put<{ ok: true }>(`/admin/announcements/${id}`, payload),
  deleteAnnouncement: (id: number) => api.delete<{ ok: true }>(`/admin/announcements/${id}`),

  /* 单页 */
  pages: () => api.get<Page[]>('/admin/pages'),
  createPage: (payload: PageInput) => api.post<{ id: number }>('/admin/pages', payload),
  updatePage: (id: number, payload: Partial<PageInput>) =>
    api.put<{ ok: true }>(`/admin/pages/${id}`, payload),
  deletePage: (id: number) => api.delete<{ ok: true }>(`/admin/pages/${id}`),

  /* 站点设置 */
  settings: () => api.get<SiteSettings>('/admin/settings'),
  updateSettings: (payload: Partial<SiteSettings>) =>
    api.put<SiteSettings>('/admin/settings', payload),
  resetTheme: (preset: string) => api.post<SiteSettings>('/admin/settings/theme/reset', { preset }),

  /* 媒体 */
  media: () => api.get<Array<{ id: number; filename: string; url: string; bytes: number; createdAt: string }>>('/admin/media'),
  deleteMedia: (id: number) => api.delete<{ ok: true }>(`/admin/media/${id}`),
  uploadConfig: () =>
    api.get<{ driver: string; configured: boolean; maxBytes: number; allowedMime: string[] }>('/upload/config'),

  /* 访客留言 */
  messages: (query?: { page?: number; pageSize?: number; handled?: boolean; search?: string }) =>
    api.get<Paginated<ContactMessage>>(`/admin/messages${toQuery(query)}`),
  updateMessage: (id: number, payload: { isHandled?: boolean }) =>
    api.put<{ ok: true }>(`/admin/messages/${id}`, payload),
  deleteMessage: (id: number) => api.delete<{ ok: true }>(`/admin/messages/${id}`),
}

/* ---------------------------- 论坛（前台） -------------------------- */

export const forumApi = {
  boards: () => api.get<{ boards: ForumBoard[] }>('/forum/boards'),

  topics: (boardSlug: string, query?: { page?: number; pageSize?: number; sort?: string }) =>
    api.get<{
      board: ForumBoard
      topics: ForumTopicSummary[]
      pagination: { page: number; pageSize: number; total: number }
    }>(`/forum/boards/${boardSlug}/topics${toQuery(query)}`),

  topic: (slug: string, query?: { page?: number; pageSize?: number }) =>
    api.get<{
      topic: ForumTopic
      board: ForumBoard
      posts: ForumPost[]
      pagination: { page: number; pageSize: number; total: number }
    }>(`/forum/topics/${slug}${toQuery(query)}`),

  recent: (limit = 6) =>
    api.get<{ topics: ForumTopicSummary[] }>(`/forum/recent${toQuery({ limit })}`),

  createTopic: (payload: ForumTopicInput) =>
    api.post<{ topic: ForumTopic; pending: boolean }>('/forum/topics', payload),

  updateTopic: (id: number, payload: { title?: string; content?: string }) =>
    api.patch<{ topic: ForumTopic }>(`/forum/topics/${id}`, payload),

  deleteTopic: (id: number) => api.delete<{ ok: true }>(`/forum/topics/${id}`),

  reply: (topicId: number, payload: { content: string; replyTo?: number | null }) =>
    api.post<{ post: ForumPost }>(`/forum/topics/${topicId}/replies`, payload),

  deletePost: (id: number) => api.delete<{ ok: true }>(`/forum/posts/${id}`),
}

/* ---------------------------- 论坛（后台） -------------------------- */

export interface AdminForumTopicRow {
  id: number
  boardId: number
  title: string
  slug: string
  status: ForumTopicStatus
  pinned: boolean
  locked: boolean
  views: number
  replyCount: number
  createdAt: string
  author: { id: number; username: string; displayName: string }
  board: { id: number; name: string; slug: string }
}

export const adminForumApi = {
  boards: () => api.get<{ boards: ForumBoard[] }>('/admin/forum/boards'),

  createBoard: (payload: ForumBoardInput) =>
    api.post<{ board: ForumBoard }>('/admin/forum/boards', payload),

  updateBoard: (id: number, payload: Partial<ForumBoardInput>) =>
    api.put<{ board: ForumBoard }>(`/admin/forum/boards/${id}`, payload),

  deleteBoard: (id: number) => api.delete<{ ok: true }>(`/admin/forum/boards/${id}`),

  topics: (query?: { page?: number; pageSize?: number; status?: string; boardId?: number }) =>
    api.get<{ topics: AdminForumTopicRow[]; pagination: { page: number; pageSize: number; total: number } }>(
      `/admin/forum/topics${toQuery(query)}`,
    ),

  moderateTopic: (
    id: number,
    payload: { pinned?: boolean; locked?: boolean; status?: ForumTopicStatus; boardId?: number },
  ) => api.patch<{ topic: { id: number } }>(`/admin/forum/topics/${id}`, payload),

  posts: (topicId: number) =>
    api.get<{
      posts: Array<{
        id: number
        content: string
        status: string
        replyTo: number | null
        createdAt: string
        author: { id: number; username: string; displayName: string }
      }>
    }>(`/admin/forum/topics/${topicId}/posts`),

  moderatePost: (id: number, status: 'published' | 'hidden' | 'deleted') =>
    api.patch<{ ok: true }>(`/admin/forum/posts/${id}`, { status }),
}
