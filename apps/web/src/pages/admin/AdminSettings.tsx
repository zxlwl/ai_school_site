/**
 * 系统设置 — 站点基本信息、联系方式、社交链接、导航与管理员密码。
 */

import { useState } from 'react';
import {
  AtSign,
  Building2,
  Check,
  Globe,
  KeyRound,
  Link2,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import type { SocialLink } from '@school/shared';
import { ApiError, authApi } from '../../lib/api';
import { useSettingsEditor } from '../../lib/hooks';
import { Field, Spinner, Switch, cn, toast } from '../../components/ui';

type Tab = 'site' | 'contact' | 'social' | 'security';

const TABS: Array<{ value: Tab; label: string; icon: typeof Globe }> = [
  { value: 'site', label: '站点信息', icon: Building2 },
  { value: 'contact', label: '联系方式', icon: AtSign },
  { value: 'social', label: '社交链接', icon: Link2 },
  { value: 'security', label: '管理员密码', icon: KeyRound },
];

export default function AdminSettings() {
  const [tab, setTab] = useState<Tab>('site');
  const { settings, loading, saving, error, update, save } = useSettingsEditor();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="text-primary" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card-theme p-6 text-sm text-red-600 dark:text-red-400">
          {error ?? '无法读取站点设置'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">系统设置</h1>
          <p className="mt-1 text-sm text-muted">站点名称、联系方式与管理员凭据</p>
        </div>
        {tab !== 'security' && (
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const ok = await save();
              if (ok) toast.success('设置已保存');
            }}
            disabled={saving}
          >
            {saving ? <Spinner /> : <Save size={15} aria-hidden />}
            保存设置
          </button>
        )}
      </header>

      {/* 标签导航 */}
      <div className="mt-5 flex flex-wrap gap-1 rounded-theme border border-border p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--c-radius)-2px)] px-3 py-2 text-sm font-medium transition-colors',
              tab === item.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
            )}
          >
            <item.icon size={14} aria-hidden />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'site' && (
          <section className="card-theme grid gap-5 p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="学校名称" required hint="显示在页头、页脚与浏览器标题">
                <input
                  className="input-theme"
                  value={settings.siteName}
                  onChange={(event) => update((prev) => ({ ...prev, siteName: event.target.value }))}
                  maxLength={80}
                />
              </Field>

              <Field label="校徽文字 / 缩写" hint="显示在页头方形标识内，最多 4 个字符">
                <input
                  className="input-theme"
                  value={settings.logoText}
                  onChange={(event) => update((prev) => ({ ...prev, logoText: event.target.value }))}
                  placeholder="例如 明德"
                  maxLength={4}
                />
              </Field>
            </div>

            <Field label="标语 / 校训" hint="显示在页头校名下方">
              <input
                className="input-theme"
                value={settings.siteTagline}
                onChange={(event) => update((prev) => ({ ...prev, siteTagline: event.target.value }))}
                maxLength={120}
              />
            </Field>

            <Field label="站点描述" hint="用于搜索引擎与分享卡片，建议 80—160 字">
              <textarea
                className="input-theme min-h-24 resize-y"
                value={settings.siteDescription}
                onChange={(event) => update((prev) => ({ ...prev, siteDescription: event.target.value }))}
                maxLength={300}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="站点图标 (favicon) 地址" hint="留空则使用浏览器默认图标">
                <div className="flex gap-2">
                  {settings.faviconUrl && (
                    <img
                      src={settings.faviconUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-theme border border-border object-contain"
                    />
                  )}
                  <input
                    className="input-theme font-mono text-xs"
                    value={settings.faviconUrl ?? ''}
                    onChange={(event) => update((prev) => ({ ...prev, faviconUrl: event.target.value || null }))}
                    placeholder="/favicon.ico 或 https://…"
                  />
                </div>
              </Field>

              <Field label="页脚备案信息">
                <input
                  className="input-theme"
                  value={settings.icpBeian}
                  onChange={(event) => update((prev) => ({ ...prev, icpBeian: event.target.value }))}
                  placeholder="例如 京ICP备0000000号"
                  maxLength={120}
                />
              </Field>
            </div>

            <Field label="页脚版权文字">
              <input
                className="input-theme"
                value={settings.footerText}
                onChange={(event) => update((prev) => ({ ...prev, footerText: event.target.value }))}
                placeholder="例如 © 2025 明德中学"
                maxLength={160}
              />
            </Field>

            <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <Switch
                checked={settings.showAnnouncementBar}
                onChange={(value) => update((prev) => ({ ...prev, showAnnouncementBar: value }))}
                label="显示首页公告条"
                description="关闭后首页不再展示最新公告"
              />
              <Switch
                checked={settings.showFeaturedArticles}
                onChange={(value) => update((prev) => ({ ...prev, showFeaturedArticles: value }))}
                label="显示推荐文章"
                description="首页展示标记为推荐的文章"
              />
              <Switch
                checked={settings.showCategories}
                onChange={(value) => update((prev) => ({ ...prev, showCategories: value }))}
                label="显示分类导航"
                description="首页展示文章分类入口"
              />
              <Switch
                checked={settings.showPages}
                onChange={(value) => update((prev) => ({ ...prev, showPages: value }))}
                label="页脚显示单页链接"
                description="在页脚列出已发布的单页"
              />
            </div>
          </section>
        )}

        {tab === 'contact' && (
          <section className="card-theme grid gap-5 p-5">
            <Field label="学校地址">
              <input
                className="input-theme"
                value={settings.contactAddress ?? ''}
                onChange={(event) => update((prev) => ({ ...prev, contactAddress: event.target.value }))}
                placeholder="例如 北京市海淀区明德路 1 号"
                maxLength={200}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="联系电话">
                <input
                  className="input-theme"
                  value={settings.contactPhone ?? ''}
                  onChange={(event) => update((prev) => ({ ...prev, contactPhone: event.target.value }))}
                  placeholder="010-00000000"
                  maxLength={60}
                />
              </Field>

              <Field label="电子邮箱">
                <input
                  type="email"
                  className="input-theme"
                  value={settings.contactEmail ?? ''}
                  onChange={(event) => update((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  placeholder="office@example.edu.cn"
                  maxLength={120}
                />
              </Field>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              这些信息会显示在页脚与「联系我们」页面。留言表单提交的内容可在「访客留言」中查看。
            </p>
          </section>
        )}

        {tab === 'social' && <SocialSettings />}

        {tab === 'security' && <PasswordSettings />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 社交链接                                                            */
/* ------------------------------------------------------------------ */

function SocialSettings() {
  const { settings, saving, update, save } = useSettingsEditor();
  const [newLink, setNewLink] = useState<SocialLink>({ label: '', url: '', icon: 'globe' });

  if (!settings) return null;

  const links = settings.socialLinks ?? [];

  const addLink = () => {
    if (!newLink.label.trim() || !newLink.url.trim()) {
      toast.error('请填写名称与链接地址');
      return;
    }
    update((prev) => ({ ...prev, socialLinks: [...(prev.socialLinks ?? []), { ...newLink }] }));
    setNewLink({ label: '', url: '', icon: 'globe' });
  };

  const removeLink = (index: number) => {
    update((prev) => ({
      ...prev,
      socialLinks: (prev.socialLinks ?? []).filter((_, position) => position !== index),
    }));
  };

  return (
    <section className="card-theme p-5">
      <h2 className="font-semibold">官方社交账号</h2>
      <p className="mt-1 text-xs text-muted">
        添加后会显示在页脚，最多 8 条。图标可选：globe / wechat / weibo / mail / phone / video
      </p>

      {links.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {links.map((link, index) => (
            <li
              key={`${link.url}-${index}`}
              className="flex items-center gap-3 rounded-theme border border-border px-3 py-2.5"
            >
              <span className="badge-theme bg-primary/10 text-primary">{link.icon ?? 'globe'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{link.label}</p>
                <p className="truncate font-mono text-xs text-muted">{link.url}</p>
              </div>
              <button
                type="button"
                onClick={() => removeLink(index)}
                className="rounded p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                aria-label={`删除 ${link.label}`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3 rounded-theme border border-dashed border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_8rem_auto] sm:items-end">
        <Field label="名称">
          <input
            className="input-theme"
            value={newLink.label}
            onChange={(event) => setNewLink((prev) => ({ ...prev, label: event.target.value }))}
            placeholder="官方微信公众号"
            maxLength={40}
          />
        </Field>
        <Field label="链接">
          <input
            className="input-theme font-mono text-xs"
            value={newLink.url}
            onChange={(event) => setNewLink((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="https://…"
          />
        </Field>
        <Field label="图标">
          <select
            className="input-theme"
            value={newLink.icon}
            onChange={(event) => setNewLink((prev) => ({ ...prev, icon: event.target.value }))}
          >
            {['globe', 'wechat', 'weibo', 'mail', 'phone', 'video'].map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="btn-ghost" onClick={addLink}>
          添加
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={async () => {
            const ok = await save();
            if (ok) toast.success('社交链接已保存');
          }}
        >
          {saving ? <Spinner /> : <Save size={15} aria-hidden />}
          保存
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 管理员密码                                                          */
/* ------------------------------------------------------------------ */

function PasswordSettings() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemoStrength(next);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!current) {
      setError('请输入当前密码');
      return;
    }
    if (next.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    if (next === 'admin123') {
      setError('新密码不能与初始密码相同');
      return;
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword(current, next);
      toast.success('密码已修改，请牢记新密码');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card-theme p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck size={16} className="text-primary" aria-hidden />
        修改管理员密码
      </h2>
      <p className="mt-1 text-xs text-muted">
        密码使用 bcrypt 加盐哈希后存储，系统不保存明文。忘记密码时可在数据库中重置。
      </p>

      <form className="mt-5 grid max-w-md gap-4" onSubmit={handleSubmit}>
        <Field label="当前密码" required>
          <input
            type="password"
            className="input-theme"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setError('');
            }}
            autoComplete="current-password"
          />
        </Field>

        <Field
          label="新密码"
          required
          hint={next ? `强度：${strength.label}` : '至少 8 位，建议包含字母与数字'}
        >
          <input
            type="password"
            className="input-theme"
            value={next}
            onChange={(event) => {
              setNext(event.target.value);
              setError('');
            }}
            autoComplete="new-password"
          />
        </Field>

        {next && (
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  index < strength.score ? strength.color : 'bg-[color-mix(in_srgb,var(--c-muted)_22%,transparent)]',
                )}
              />
            ))}
          </div>
        )}

        <Field label="确认新密码" required>
          <input
            type="password"
            className="input-theme"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError('');
            }}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <p className="rounded-theme border border-red-500/30 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-fit" disabled={submitting}>
          {submitting ? <Spinner /> : <UserCog size={15} aria-hidden />}
          修改密码
        </button>
      </form>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Check size={14} className="text-emerald-500" aria-hidden />
          安全建议
        </h3>
        <ul className="mt-2 grid gap-1.5 text-xs leading-relaxed text-muted">
          <li>· 首次部署后立即修改默认密码 admin123。</li>
          <li>· AUTH_SECRET 使用足够长的随机字符串，且不要提交到代码仓库。</li>
          <li>· 生产环境务必通过 HTTPS 访问后台，Cookie 的 Secure 标记才会生效。</li>
          <li>· 数据库连接串具备完整权限，切勿在前端或公开仓库中暴露。</li>
        </ul>
      </div>
    </section>
  );
}

/** 简易密码强度估算：以长度为主，字符种类为辅 */
function useMemoStrength(password: string) {
  const score = (() => {
    if (!password) return 0;
    let value = 0;
    if (password.length >= 8) value += 1;
    if (password.length >= 12) value += 1;
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) value += 1;
    if (/[^a-zA-Z0-9]/.test(password)) value += 1;
    return Math.min(value, 4);
  })();

  const label = ['很弱', '较弱', '一般', '较强', '很强'][score] ?? '很弱';
  const color = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'][score] ?? 'bg-red-500';

  return { score, label, color };
}
