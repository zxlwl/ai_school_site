/**
 * 数据获取与状态管理 hooks。
 *
 * 这个项目没有引入 React Query 之类的库：API 面不宽，手写几个小 hook 反而
 * 更轻、更容易读懂。约定统一为 { data, loading, error, reload }，页面拿到
 * 后可以直接渲染四种状态：加载中 / 出错 / 空 / 有数据。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Announcement,
  Article,
  ArticleQuery,
  Category,
  Paginated,
  Page,
  SiteSettings,
  ThemeSettings,
} from '@school/shared';
import type { AdminArticle, ArticleDetail } from './api';
import { ApiError, UnauthorizedError, adminApi, authApi, publicApi } from './api';

/* ------------------------------------------------------------------ */
/* 通用异步 hook                                                       */
/* ------------------------------------------------------------------ */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * 跑一个异步任务并把结果包成标准状态。
 *
 * dependencies 变化会重新执行；用 requestId 标记「最新一次请求」，
 * 避免快速切换筛选条件时先发的请求后返回、把新数据覆盖掉。
 */
export function useAsync<T>(task: () => Promise<T>, dependencies: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const taskRef = useRef(task);
  taskRef.current = task;
  const requestId = useRef(0);

  useEffect(() => {
    const current = ++requestId.current;
    let cancelled = false;

    setLoading(true);
    setError(null);

    taskRef
      .current()
      .then((result) => {
        if (cancelled || current !== requestId.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled || current !== requestId.current) return;
        setError(toMessage(err));
      })
      .finally(() => {
        if (cancelled || current !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { data, loading, error, reload, setData };
}

export function toMessage(err: unknown): string {
  if (err instanceof UnauthorizedError) return '登录状态已失效，请重新登录';
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return '发生未知错误';
}

/* ------------------------------------------------------------------ */
/* 防抖                                                                */
/* ------------------------------------------------------------------ */

/** 输入框搜索用：延迟 value 的更新，避免每敲一个字就发一次请求 */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ */
/* 站点设置（带全局缓存，避免每个组件各请求一次）                        */
/* ------------------------------------------------------------------ */

let settingsCache: SiteSettings | null = null;
let settingsPromise: Promise<SiteSettings> | null = null;
const settingsListeners = new Set<(settings: SiteSettings) => void>();

/** 供后台保存后主动刷新缓存用 */
export function invalidateSettings(next?: SiteSettings) {
  if (next) {
    settingsCache = next;
    settingsListeners.forEach((listener) => listener(next));
  } else {
    settingsCache = null;
    settingsPromise = null;
  }
}

function loadSettings(): Promise<SiteSettings> {
  if (settingsCache) return Promise.resolve(settingsCache);
  if (!settingsPromise) {
    settingsPromise = publicApi
      .settings()
      .then((settings) => {
        settingsCache = settings;
        return settings;
      })
      .catch((err) => {
        settingsPromise = null; // 失败后允许重试
        throw err;
      });
  }
  return settingsPromise;
}

/** 读取站点设置；同一页面多处使用只会请求一次 */
export function useSiteSettings() {
  const [data, setData] = useState<SiteSettings | null>(settingsCache);
  const [loading, setLoading] = useState(!settingsCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (settingsCache) {
      setData(settingsCache);
      setLoading(false);
    } else {
      setLoading(true);
    }

    loadSettings()
      .then((settings) => {
        if (!cancelled) {
          setData(settings);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 后台保存设置后，前台组件也能同步刷新
  useEffect(() => {
    const listener = (settings: SiteSettings) => setData(settings);
    settingsListeners.add(listener);
    return () => {
      settingsListeners.delete(listener);
    };
  }, []);

  return { data, loading, error };
}

/**
 * 后台设置编辑：维护一份本地副本，允许在未保存时反复修改，
 * 保存成功后再写回全局缓存，触发前台标题/主题更新。
 */
export function useSettingsEditor() {
  const [settings, setSettings] = useState<SiteSettings | null>(settingsCache);
  const [loading, setLoading] = useState(!settingsCache);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 后台应拿到最新数据，绕过缓存
    adminApi
      .settings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        invalidateSettings(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((updater: (prev: SiteSettings) => SiteSettings) => {
    setSettings((prev) => (prev ? updater(prev) : prev));
  }, []);

  useEffect(() => {
    const listener = (value: SiteSettings) => setSettings((prev) => prev ?? value);
    settingsListeners.add(listener);
    return () => {
      settingsListeners.delete(listener);
    };
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!settings) return false;
    setSaving(true);
    setError(null);
    try {
      const saved = await adminApi.updateSettings(settings);
      setSettings(saved);
      invalidateSettings(saved);
      return true;
    } catch (err) {
      setError(toMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings]);

  return { settings, loading, saving, error, update, save, setSettings };
}

/** 只取主题部分的小 hook，供布局使用 */
export function useTheme(): ThemeSettings | null {
  const { data } = useSiteSettings();
  return data?.theme ?? null;
}

/* ------------------------------------------------------------------ */
/* 业务数据 hooks                                                      */
/* ------------------------------------------------------------------ */

export function useCategories() {
  return useAsync<Category[]>(() => publicApi.categories(), []);
}

/** 前台文章列表：支持分类、搜索、排序、分页 */
export function useArticles(params: {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: ArticleQuery['sort'];
}) {
  const { page = 1, pageSize = 9, category, search, featured, sort } = params;
  return useAsync<Paginated<Article>>(
    () => publicApi.articles({ page, pageSize, category, search, featured, sort }),
    [page, pageSize, category, search, featured, sort],
  );
}

/** 后台文章列表：带状态筛选 */
export function useAdminArticles(page: number, pageSize: number, status: string, search: string) {
  return useAsync<Paginated<AdminArticle>>(
    () => adminApi.articles({ page, pageSize, status: status || undefined, search: search || undefined }),
    [page, pageSize, status, search],
  );
}

export function useAnnouncements() {
  return useAsync<Announcement[]>(() => publicApi.announcements(), []);
}

/** 单篇文章详情（按 slug） */
export function useArticle(slug: string | undefined) {
  return useAsync<ArticleDetail | null>(
    () => (slug ? publicApi.article(slug) : Promise.resolve(null)),
    [slug],
  );
}

/** 单个单页详情（按 slug） */
export function usePage(slug: string | undefined) {
  return useAsync<Page | null>(
    () => (slug ? publicApi.page(slug) : Promise.resolve(null)),
    [slug],
  );
}

/** 后台单页列表 */
export function usePages() {
  return useAsync<Page[]>(() => adminApi.pages(), []);
}

/** 首页聚合数据：设置 + 公告 + 推荐 + 最新 + 分类 */
export interface HomeData {
  settings: SiteSettings;
  announcements: Announcement[];
  featured: Article[];
  latest: Article[];
  categories: Category[];
}

export function useHome() {
  return useAsync<HomeData>(() => publicApi.home(), []);
}

/**
 * 当前登录会话。返回 authenticated / username / mustChangePassword，
 * 供后台布局判断登录状态与提示修改初始密码。
 */
export interface SessionState {
  authenticated: boolean;
  username?: string;
  mustChangePassword: boolean;
}

export function useSession() {
  return useAsync<SessionState>(() => authApi.session() as Promise<SessionState>, []);
}

/* ------------------------------------------------------------------ */
/* 其他工具 hook                                                       */
/* ------------------------------------------------------------------ */

/** 监听滚动超过阈值，用于页头加阴影之类的效果 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

/** 点击外部关闭下拉/抽屉 */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);

  return ref;
}

/** 给页面设置标题，并在卸载时恢复 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
