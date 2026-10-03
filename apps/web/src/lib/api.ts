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
  SessionInfo,
  SiteSettings,
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
