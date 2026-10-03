/**
 * 应用根组件 — 路由表。
 *
 * 前台与后台挂在同一棵路由树上：
 *   /             → SiteLayout（页头 + 页脚 + Toast）
 *     /           → HomePage
 *     /articles   → 全部文章
 *     /category/:slug
 *     /article/:slug
 *     /announcements
 *     /search
 *     /contact
 *     /:slug      → 通用单页（放最后，避免吞掉上面的固定路由）
 *   /admin/*      → AdminLayout（侧边栏 + 鉴权守卫）
 */

import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { LoadingState } from './components/ui'
import { HomePage } from './pages/HomePage'
import { ArticleListPage } from './pages/ArticleListPage'
import { ArticleDetailPage } from './pages/ArticleDetailPage'
import { AnnouncementsPage, NotFoundPage, SinglePage } from './pages/PageView'
import { ContactPage } from './pages/ContactPage'

// 后台按需加载：访客浏览前台时不必下载整个管理端代码
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminArticles = lazy(() => import('./pages/admin/AdminArticles'))
const AdminArticleEdit = lazy(() => import('./pages/admin/AdminArticleEdit'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'))
const AdminPages = lazy(() => import('./pages/admin/AdminPages'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminAppearance = lazy(() => import('./pages/admin/AdminAppearance'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState label="正在加载…" minHeight={420} />}>
        <Routes>
          {/* ---------------------------- 前台 ---------------------------- */}
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/articles" element={<ArticleListPage mode="all" />} />
            <Route path="/category/:slug" element={<ArticleListPage mode="category" />} />
            <Route path="/search" element={<ArticleListPage mode="search" />} />
            <Route path="/article/:slug" element={<ArticleDetailPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            {/* 通用单页兜底：必须放在所有固定路由之后 */}
            <Route path="/:slug" element={<SinglePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* ---------------------------- 后台 ---------------------------- */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="articles" element={<AdminArticles />} />
            <Route path="articles/new" element={<AdminArticleEdit />} />
            <Route path="articles/:id" element={<AdminArticleEdit />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="pages" element={<AdminPages />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="appearance" element={<AdminAppearance />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
