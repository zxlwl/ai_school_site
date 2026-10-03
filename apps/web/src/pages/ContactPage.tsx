/**
 * 联系我们页面 — 展示联系方式 + 在线留言表单。
 *
 * 留言写入 messages 表，管理员可在后台查看与标记处理。
 * 表单只做前端基础校验，真正的校验在后端（zod），前端不做安全假设。
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import { publicApi, ApiError } from '../lib/api'
import { useSiteSettings } from '../lib/hooks'
import { Breadcrumbs, Field, Spinner, toast } from '../components/ui'

export function ContactPage() {
  const { data: settings } = useSiteSettings()

  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = '请填写称呼'
    else if (form.name.length > 100) next.name = '称呼过长'
    if (!form.content.trim()) next.content = '请填写留言内容'
    else if (form.content.length > 5000) next.content = '留言内容过长（上限 5000 字）'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = '邮箱格式不正确'
    if (form.phone && !/^[\d\s\-+()]{5,20}$/.test(form.phone)) next.phone = '电话格式不正确'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate() || submitting) return

    setSubmitting(true)
    try {
      await publicApi.submitMessage({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        subject: form.subject.trim() || undefined,
        content: form.content.trim(),
      })
      toast.success('留言已提交，感谢你的反馈！')
      setForm({ name: '', email: '', phone: '', subject: '', content: '' })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-theme py-8 md:py-12">
      <Breadcrumbs items={[{ label: '首页', to: '/' }, { label: '联系我们' }]} />

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">联系我们</h1>
        <p className="mt-2 text-sm text-muted">欢迎来电、来函或到校交流，我们会在工作日内回复。</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* 联系方式卡片 */}
        <aside className="space-y-4">
          <div className="card-theme p-5">
            <h2 className="text-sm font-semibold">联系方式</h2>
            <ul className="mt-4 space-y-4 text-sm">
              {settings?.contactAddress && (
                <li className="flex gap-3">
                  <MapPin size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <span className="text-muted">{settings.contactAddress}</span>
                </li>
              )}
              {settings?.contactPhone && (
                <li className="flex gap-3">
                  <Phone size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <a href={`tel:${settings.contactPhone}`} className="text-muted transition-colors hover:text-primary">
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings?.contactEmail && (
                <li className="flex gap-3">
                  <Mail size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <a href={`mailto:${settings.contactEmail}`} className="text-muted transition-colors hover:text-primary">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              <li className="flex gap-3">
                <Clock size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span className="text-muted">周一至周五 08:00 – 17:30</span>
              </li>
            </ul>
          </div>

          <div className="card-theme p-5">
            <h2 className="text-sm font-semibold">常用入口</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              <li>
                <Link to="/about" className="text-muted transition-colors hover:text-primary">
                  学校简介
                </Link>
              </li>
              <li>
                <Link to="/announcements" className="text-muted transition-colors hover:text-primary">
                  通知公告
                </Link>
              </li>
              <li>
                <Link to="/articles" className="text-muted transition-colors hover:text-primary">
                  校园资讯
                </Link>
              </li>
            </ul>
          </div>
        </aside>

        {/* 留言表单 */}
        <section className="card-theme p-6">
          <h2 className="text-lg font-semibold">在线留言</h2>
          <p className="mt-1.5 text-sm text-muted">填写下方表单，我们会尽快与你取得联系。</p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="称呼" required error={errors.name}>
                <input
                  className="input-theme"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="你的姓名或称谓"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="联系电话" error={errors.phone}>
                <input
                  className="input-theme"
                  value={form.phone}
                  onChange={update('phone')}
                  placeholder="选填"
                  maxLength={20}
                  inputMode="tel"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="电子邮箱" error={errors.email}>
                <input
                  className="input-theme"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="选填"
                  maxLength={160}
                  type="email"
                />
              </Field>
              <Field label="主题">
                <input
                  className="input-theme"
                  value={form.subject}
                  onChange={update('subject')}
                  placeholder="选填，例如：转学咨询"
                  maxLength={160}
                />
              </Field>
            </div>

            <Field label="留言内容" required error={errors.content} hint={`${form.content.length}/5000`}>
              <textarea
                className="input-theme min-h-32 resize-y"
                value={form.content}
                onChange={update('content')}
                placeholder="请描述你的问题或建议…"
                maxLength={5000}
                required
              />
            </Field>

            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted">留言仅用于沟通，我们不会对外公开。</p>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? <Spinner /> : <Send size={15} aria-hidden />}
                {submitting ? '提交中…' : '提交留言'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
