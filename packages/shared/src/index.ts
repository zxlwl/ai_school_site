/**
 * @school/shared — 前后端共享的类型契约与常量
 *
 * 该文件是前后端唯一的类型真相来源，任何数据结构变更都要先改这里。
 */

/* ------------------------------------------------------------------ */
/* 通用                                                                */
/* ------------------------------------------------------------------ */

export interface ApiError {
  error: string
  message: string
  details?: unknown
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/* ------------------------------------------------------------------ */
/* 内容状态                                                            */
/* ------------------------------------------------------------------ */

/** 内容发布状态。draft 仅后台可见，published 对前台公开 */
export type ContentStatus = 'draft' | 'published'

export const CONTENT_STATUSES: ContentStatus[] = ['draft', 'published']

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  draft: '草稿',
  published: '已发布',
}

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */

export interface Category {
  id: number
  name: string
  /** URL 短标识，全局唯一，如 "campus-news" */
  slug: string
  description: string | null
  /** 分类色，十六进制，用于前台标签着色 */
  color: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  /** 该分类下的文章数量（列表接口附带） */
  articleCount?: number
}

export interface CategoryInput {
  name: string
  slug?: string
  description?: string | null
  color?: string | null
  sortOrder?: number
}

/* ------------------------------------------------------------------ */
/* 文章                                                                */
/* ------------------------------------------------------------------ */

export interface Article {
  id: number
  title: string
  slug: string
  /** Markdown 正文 */
  content: string
  excerpt: string | null
  coverImage: string | null
  categoryId: number | null
  status: ContentStatus
  /** 是否置顶到列表首位 */
  featured: boolean
  /** 浏览量 */
  views: number
  author: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** 关联分类（详情/列表接口附带） */
  category?: Category | null
}

export interface ArticleInput {
  title: string
  slug?: string
  content: string
  excerpt?: string | null
  coverImage?: string | null
  categoryId?: number | null
  status?: ContentStatus
  featured?: boolean
  author?: string | null
  publishedAt?: string | null
}

export interface ArticleQuery {
  page?: number
  pageSize?: number
  /** 按分类 slug 过滤 */
  category?: string
  /** 关键词搜索标题与摘要 */
  search?: string
  /** 是否置顶 */
  featured?: boolean
  /** 仅后台使用：按状态过滤 */
  status?: ContentStatus
  /** 排序字段 */
  sort?: 'latest' | 'oldest' | 'popular' | 'title'
}

/* ------------------------------------------------------------------ */
/* 公告                                                                */
/* ------------------------------------------------------------------ */

export interface Announcement {
  id: number
  title: string
  content: string
  /** 重要性级别，影响前台展示样式 */
  level: AnnouncementLevel
  status: ContentStatus
  /** 是否在首页/顶栏滚动展示 */
  pinned: boolean
  /** 生效区间，null 表示不限 */
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

export type AnnouncementLevel = 'info' | 'important' | 'urgent'

export const ANNOUNCEMENT_LEVELS: AnnouncementLevel[] = ['info', 'important', 'urgent']

export const ANNOUNCEMENT_LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: '普通',
  important: '重要',
  urgent: '紧急',
}

export interface AnnouncementInput {
  title: string
  content: string
  level?: AnnouncementLevel
  status?: ContentStatus
  pinned?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

/* ------------------------------------------------------------------ */
/* 单页（关于我们 / 联系方式 等）                                      */
/* ------------------------------------------------------------------ */

export interface Page {
  id: number
  title: string
  slug: string
  /** 页面摘要，用于列表展示与 SEO 描述 */
  summary: string | null
  content: string
  status: ContentStatus
  /** 是否显示在顶部导航栏 */
  showInNav: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PageInput {
  title: string
  slug?: string
  summary?: string | null
  content: string
  status?: ContentStatus
  showInNav?: boolean
  sortOrder?: number
}

/* ------------------------------------------------------------------ */
/* 站点设置与主题                                                      */
/* ------------------------------------------------------------------ */

export interface SiteSettings {
  /* 基本信息 */
  siteName: string
  /** 站点副标题 / 口号 */
  siteTagline: string
  siteDescription: string
  logoText: string
  faviconUrl: string | null

  /* 联系方式 */
  contactEmail: string
  contactPhone: string
  contactAddress: string

  /* 页脚 */
  footerText: string
  icpBeian: string

  /* 首页展示开关 */
  showAnnouncementBar: boolean
  showFeaturedArticles: boolean
  featuredCount: number
  showCategories: boolean
  showPages: boolean

  /* 主题 */
  theme: ThemeSettings

  /* 社交媒体链接 */
  socialLinks: SocialLink[]
}

export interface SocialLink {
  label: string
  url: string
  icon: string
}

export interface ThemeSettings {
  /** 预设主题标识，选择后仍可单独微调颜色 */
  preset: ThemePresetId
  /** 主色（按钮、链接、强调） */
  primary: string
  /** 主色上的文字颜色 */
  primaryForeground: string
  /** 强调色 */
  accent: string
  /** 页面背景 */
  background: string
  /** 卡片/浮层背景 */
  surface: string
  /** 正文文字 */
  foreground: string
  /** 次要文字 */
  muted: string
  /** 边框 */
  border: string
  /** 圆角程度 */
  radius: RadiusScale
  /** 正文字体栈标识 */
  fontFamily: FontChoice
  /** 内容区最大宽度 */
  containerWidth: ContainerWidth
  /** 暗色模式策略 */
  colorMode: ColorMode
}

export type RadiusScale = 'none' | 'small' | 'medium' | 'large'
export type FontChoice = 'system' | 'sans' | 'serif' | 'mono'
export type ContainerWidth = 'narrow' | 'normal' | 'wide'
export type ColorMode = 'light' | 'dark' | 'auto'

export type ThemePresetId =
  | 'academic-blue'
  | 'emerald'
  | 'crimson'
  | 'violet'
  | 'slate'
  | 'amber'

export interface ThemePreset {
  id: ThemePresetId
  name: string
  description: string
  colors: Pick<
    ThemeSettings,
    | 'primary'
    | 'primaryForeground'
    | 'accent'
    | 'background'
    | 'surface'
    | 'foreground'
    | 'muted'
    | 'border'
  >
}

/* ------------------------------------------------------------------ */
/* 仪表盘统计                                                          */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  articles: { total: number; published: number; draft: number; views: number }
  announcements: { total: number; published: number; draft: number }
  categories: number
  pages: number
  /** 留言统计：总数与未处理数 */
  messages: { total: number; pending: number }
  recentArticles: DashboardRecentArticle[]
}

/** 仪表盘「最近文章」列表项：附带分类名，便于直接展示 */
export interface DashboardRecentArticle {
  id: number
  title: string
  slug: string
  status: ContentStatus
  views: number
  featured: boolean
  publishedAt: string | null
  createdAt: string
  categoryName: string | null
}

/* ------------------------------------------------------------------ */
/* 认证                                                                */
/* ------------------------------------------------------------------ */

export interface LoginRequest {
  password: string
}

export interface LoginResponse {
  ok: true
  mustChangePassword: boolean
}

export interface SessionInfo {
  authenticated: boolean
  /** 是否仍在使用初始默认密码，提示尽快修改 */
  mustChangePassword: boolean
  /** 当前登录用户名 */
  username?: string
}

/* ------------------------------------------------------------------ */
/* 媒体（图片）                                                        */
/* ------------------------------------------------------------------ */

/**
 * 图片上传能力由部署环境决定：
 * - dataurl：无对象存储时，图片以 base64 存库，开箱即用（推荐默认，无需信用卡）
 * - s3：兼容 S3 的对象存储（Cloudflare R2 / Backblaze B2 / MinIO 等）
 */
export type StorageDriver = 'dataurl' | 's3'

export interface UploadResult {
  url: string
  /** dataurl 模式下返回，便于前端确认体积 */
  bytes?: number
  driver: StorageDriver
}

export interface MediaItem {
  id: number
  filename: string
  url: string
  mimeType: string
  bytes: number
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* 访客留言                                                            */
/* ------------------------------------------------------------------ */

export interface ContactMessage {
  id: number
  name: string
  email: string | null
  phone: string | null
  subject: string | null
  content: string
  /** 管理员是否已处理 */
  isHandled: boolean
  createdAt: string
  updatedAt: string
}

export interface ContactMessageInput {
  name: string
  content: string
  email?: string
  phone?: string
  subject?: string
}

/* ------------------------------------------------------------------ */
/* 主题预设数据（前端与后台共用）                                      */
/* ------------------------------------------------------------------ */

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'academic-blue',
    name: '学院蓝',
    description: '沉稳专业，适合综合性学校',
    colors: {
      primary: '#2563eb',
      primaryForeground: '#ffffff',
      accent: '#0ea5e9',
      background: '#f8fafc',
      surface: '#ffffff',
      foreground: '#0f172a',
      muted: '#64748b',
      border: '#e2e8f0',
    },
  },
  {
    id: 'emerald',
    name: '青藤绿',
    description: '清新自然，富有生命力',
    colors: {
      primary: '#059669',
      primaryForeground: '#ffffff',
      accent: '#14b8a6',
      background: '#f7fdfa',
      surface: '#ffffff',
      foreground: '#062c22',
      muted: '#5b7c73',
      border: '#d7ebe4',
    },
  },
  {
    id: 'crimson',
    name: '校徽红',
    description: '传统厚重，仪式感强',
    colors: {
      primary: '#b91c1c',
      primaryForeground: '#ffffff',
      accent: '#f59e0b',
      background: '#fdf9f8',
      surface: '#ffffff',
      foreground: '#2b1313',
      muted: '#7c6a68',
      border: '#ecdcd9',
    },
  },
  {
    id: 'violet',
    name: '创新紫',
    description: '现代科技，适合理工院校',
    colors: {
      primary: '#7c3aed',
      primaryForeground: '#ffffff',
      accent: '#ec4899',
      background: '#faf8ff',
      surface: '#ffffff',
      foreground: '#1e1333',
      muted: '#6b6183',
      border: '#e6e0f5',
    },
  },
  {
    id: 'slate',
    name: '极简灰',
    description: '克制内敛，突出内容本身',
    colors: {
      primary: '#334155',
      primaryForeground: '#ffffff',
      accent: '#0ea5e9',
      background: '#f8fafc',
      surface: '#ffffff',
      foreground: '#0f172a',
      muted: '#64748b',
      border: '#e2e8f0',
    },
  },
  {
    id: 'amber',
    name: '暖阳橙',
    description: '温暖亲切，适合中小学',
    colors: {
      primary: '#ea580c',
      primaryForeground: '#ffffff',
      accent: '#eab308',
      background: '#fffbf5',
      surface: '#ffffff',
      foreground: '#2d1a0b',
      muted: '#7d6a58',
      border: '#f2e5d7',
    },
  },
]

export const RADIUS_SCALE_LABEL: Record<RadiusScale, string> = {
  none: '直角',
  small: '小圆角',
  medium: '中圆角',
  large: '大圆角',
}

export const FONT_CHOICE_LABEL: Record<FontChoice, string> = {
  system: '系统默认',
  sans: '无衬线',
  serif: '衬线（更学术）',
  mono: '等宽',
}

export const CONTAINER_WIDTH_LABEL: Record<ContainerWidth, string> = {
  narrow: '窄（阅读友好）',
  normal: '标准',
  wide: '宽（信息密集）',
}

export const COLOR_MODE_LABEL: Record<ColorMode, string> = {
  light: '始终浅色',
  dark: '始终深色',
  auto: '跟随系统',
}

/** 主题在 CSS 中实际生效的圆角像素值 */
export const RADIUS_PX: Record<RadiusScale, string> = {
  none: '0px',
  small: '0.375rem',
  medium: '0.75rem',
  large: '1.25rem',
}

export const CONTAINER_PX: Record<ContainerWidth, string> = {
  narrow: '56rem',
  normal: '72rem',
  wide: '88rem',
}

export const FONT_STACK: Record<FontChoice, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  sans: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", ui-sans-serif, sans-serif',
  serif:
    '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, ui-serif, serif',
  mono: '"JetBrains Mono", "Cascadia Code", ui-monospace, "Microsoft YaHei", monospace',
}

/* ------------------------------------------------------------------ */
/* 默认站点设置                                                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: '明德中学',
  siteTagline: '明德笃学 · 知行合一',
  siteDescription: '明德中学官方网站，发布校园新闻、通知公告与教学动态。',
  logoText: '明德',
  faviconUrl: null,
  contactEmail: 'office@example.edu.cn',
  contactPhone: '010-0000 0000',
  contactAddress: '某某市某某区某某路 1 号',
  footerText: '© 明德中学 · 保留所有权利',
  icpBeian: '',
  showAnnouncementBar: true,
  showFeaturedArticles: true,
  featuredCount: 3,
  showCategories: true,
  showPages: true,
  theme: {
    preset: 'academic-blue',
    ...THEME_PRESETS[0].colors,
    radius: 'medium',
    fontFamily: 'system',
    containerWidth: 'normal',
    colorMode: 'light',
  },
  socialLinks: [],
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

/** 生成 URL 友好的 slug；中文会保留（由后端负责转义存库） */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** 从 Markdown 正文推导摘要 */
export function deriveExcerpt(markdown: string, maxLength = 120): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 格式化为中文日期，如 2026年3月5日 */
export function formatDateCN(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/** 相对时间，用于列表展示 */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(date)
}
