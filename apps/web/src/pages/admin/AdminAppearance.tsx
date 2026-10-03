/**
 * 外观主题设置 — 后台可视化改前端样式。
 *
 * 左侧调参、右侧实时预览：改动通过 applyTheme() 直接写 CSS 变量，
 * 与前台使用同一套变量，所以「所见即所得」是真实的一致，而不是截图模拟。
 * 只有点击保存才会写回数据库。
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Paintbrush, Palette, RotateCcw, Save, Sliders } from 'lucide-react';
import type { SiteSettings, ThemeSettings } from '@school/shared';
import {
  COLOR_MODE_LABEL,
  CONTAINER_PX,
  CONTAINER_WIDTH_LABEL,
  DEFAULT_SETTINGS,
  FONT_CHOICE_LABEL,
  FONT_STACK,
  RADIUS_PX,
  RADIUS_SCALE_LABEL,
  THEME_PRESETS,
} from '@school/shared';
import { ApiError, adminApi } from '../../lib/api';
import { useSettingsEditor } from '../../lib/hooks';
import { applyTheme } from '../../lib/theme';
import { ColorInput, Field, Spinner, cn, toast } from '../../components/ui';

export default function AdminAppearance() {
  const { settings, loading, saving, error, update, save } = useSettingsEditor();
  const [dirty, setDirty] = useState(false);

  const theme = settings?.theme;

  // 任何改动立即作用到当前页面，方便边改边看
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  /** 修改主题字段并标记为待保存 */
  const setTheme = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    update((prev) => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
    setDirty(true);
  };

  /** 首页推荐数量属于站点设置，不属于主题 */
  const setFeaturedCount = (value: number) => {
    update((prev) => ({ ...prev, featuredCount: value }));
    setDirty(true);
  };

  const applyPreset = (presetId: ThemeSettings['preset']) => {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    update((prev) => ({
      ...prev,
      theme: { ...prev.theme, ...preset.colors, preset: presetId },
    }));
    setDirty(true);
    toast.success(`已应用「${preset.name}」主题`);
  };

  const handleReset = () => {
    update((prev) => ({ ...prev, theme: { ...DEFAULT_SETTINGS.theme } }));
    setDirty(true);
    toast.info('已恢复默认主题，记得保存');
  };

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      setDirty(false);
      toast.success('外观已保存，前台立即生效');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="text-primary" />
      </div>
    );
  }

  if (error || !theme) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card-theme p-6 text-sm text-red-600 dark:text-red-400">
          {error ?? '无法读取站点设置'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">外观主题</h1>
          <p className="mt-1 text-sm text-muted">
            调整配色、圆角与排版，右侧预览与前台使用同一套样式变量
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={handleReset}>
            <RotateCcw size={15} aria-hidden />
            恢复默认
          </button>
          <button
            type="button"
            className={cn('btn-primary', dirty && 'ring-2 ring-primary/30')}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Spinner /> : <Save size={15} aria-hidden />}
            {dirty ? '保存更改' : '保存'}
          </button>
        </div>
      </header>

      {dirty && (
        <p className="mt-4 rounded-theme border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          有未保存的改动 —— 预览已生效，点击「保存更改」后才会同步到线上前台。
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        {/* ---------------------------- 调参区 ---------------------------- */}
        <div className="space-y-5">
          {/* 预设配色 */}
          <section className="card-theme p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Palette size={16} className="text-primary" aria-hidden />
              预设配色
            </h2>
            <p className="mt-1 text-xs text-muted">选择一套预设快速定型，之后仍可逐项微调</p>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {THEME_PRESETS.map((preset) => {
                const active = theme.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={cn(
                      'relative flex items-center gap-3 rounded-theme border p-3 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/6'
                        : 'border-border hover:border-primary/40 hover:bg-[color-mix(in_srgb,var(--c-muted)_4%,transparent)]',
                    )}
                  >
                    <span className="flex shrink-0 gap-1" aria-hidden>
                      {[preset.colors.primary, preset.colors.accent, preset.colors.surface].map((color) => (
                        <span
                          key={color}
                          className="h-6 w-3 rounded-full border border-black/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{preset.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">{preset.description}</span>
                    </span>
                    {active && <Check size={15} className="shrink-0 text-primary" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 颜色 */}
          <section className="card-theme p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Paintbrush size={16} className="text-primary" aria-hidden />
              颜色
            </h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <ColorInput
                label="主题色"
                value={theme.primary}
                onChange={(value) => setTheme('primary', value)}
                hint="按钮、链接、强调文字"
              />
              <ColorInput
                label="主题色文字"
                value={theme.primaryForeground}
                onChange={(value) => setTheme('primaryForeground', value)}
                hint="主题色块上的文字颜色"
              />
              <ColorInput
                label="辅助色"
                value={theme.accent}
                onChange={(value) => setTheme('accent', value)}
                hint="标签、次要强调"
              />
              <ColorInput
                label="页面背景"
                value={theme.background}
                onChange={(value) => setTheme('background', value)}
              />
              <ColorInput
                label="卡片表面"
                value={theme.surface}
                onChange={(value) => setTheme('surface', value)}
                hint="卡片、导航栏底色"
              />
              <ColorInput
                label="正文颜色"
                value={theme.foreground}
                onChange={(value) => setTheme('foreground', value)}
              />
              <ColorInput
                label="次要文字"
                value={theme.muted}
                onChange={(value) => setTheme('muted', value)}
                hint="说明文字、日期"
              />
              <ColorInput
                label="边框颜色"
                value={theme.border}
                onChange={(value) => setTheme('border', value)}
              />
            </div>
          </section>

          {/* 排版与布局 */}
          <section className="card-theme p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Sliders size={16} className="text-primary" aria-hidden />
              排版与布局
            </h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="圆角">
                <SegmentedControl
                  options={(Object.keys(RADIUS_PX) as Array<keyof typeof RADIUS_PX>).map((key) => ({
                    value: key,
                    label: RADIUS_SCALE_LABEL[key],
                  }))}
                  value={theme.radius}
                  onChange={(value) => setTheme('radius', value as ThemeSettings['radius'])}
                />
              </Field>

              <Field label="内容宽度">
                <SegmentedControl
                  options={(Object.keys(CONTAINER_PX) as Array<keyof typeof CONTAINER_PX>).map((key) => ({
                    value: key,
                    label: CONTAINER_WIDTH_LABEL[key],
                  }))}
                  value={theme.containerWidth}
                  onChange={(value) => setTheme('containerWidth', value as ThemeSettings['containerWidth'])}
                />
              </Field>

              <Field label="字体">
                <SegmentedControl
                  options={(Object.keys(FONT_STACK) as Array<keyof typeof FONT_STACK>).map((key) => ({
                    value: key,
                    label: FONT_CHOICE_LABEL[key],
                  }))}
                  value={theme.fontFamily}
                  onChange={(value) => setTheme('fontFamily', value as ThemeSettings['fontFamily'])}
                />
              </Field>

              <Field label="明暗模式" hint="跟随系统时尊重访客设备的偏好">
                <SegmentedControl
                  options={(Object.keys(COLOR_MODE_LABEL) as Array<keyof typeof COLOR_MODE_LABEL>).map((key) => ({
                    value: key,
                    label: COLOR_MODE_LABEL[key],
                  }))}
                  value={theme.colorMode}
                  onChange={(value) => setTheme('colorMode', value as ThemeSettings['colorMode'])}
                />
              </Field>

              <Field label="首页推荐数量" hint="1 – 12 篇">
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="input-theme"
                  value={settings?.featuredCount ?? 3}
                  onChange={(event) => setFeaturedCount(Number(event.target.value))}
                />
              </Field>
            </div>
          </section>
        </div>

        {/* ---------------------------- 实时预览 ---------------------------- */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card-theme overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted">
              <Eye size={13} aria-hidden />
              实时预览
              <span className="ml-auto">
                {theme.colorMode === 'auto' ? '跟随系统' : COLOR_MODE_LABEL[theme.colorMode]}
              </span>
            </div>

            <div className="p-4" style={{ backgroundColor: 'var(--c-bg)' }}>
              {/* 模拟页头 */}
              <div
                className="flex items-center gap-2 rounded-theme border px-3 py-2.5"
                style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-[calc(var(--c-radius)*0.6)] text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
                >
                  校
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--c-fg)' }}>
                  {settings?.siteName ?? '学校官网'}
                </span>
                <span className="ml-auto flex gap-2 text-[10px]" style={{ color: 'var(--c-muted)' }}>
                  <span>首页</span>
                  <span>资讯</span>
                  <span>公告</span>
                </span>
              </div>

              {/* 模拟主视觉 */}
              <div
                className="mt-3 rounded-theme p-4"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, var(--c-primary) 14%, var(--c-surface)), color-mix(in srgb, var(--c-accent) 12%, var(--c-surface)))`,
                  border: '1px solid var(--c-border)',
                }}
              >
                <p className="text-sm font-bold leading-snug" style={{ color: 'var(--c-fg)' }}>
                  明德笃学 · 知行合一
                </p>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                  这里展示站点主视觉区域的文字与配色效果。
                </p>
                <div className="mt-3 flex gap-2">
                  <span
                    className="rounded-[calc(var(--c-radius)*0.7)] px-3 py-1.5 text-[11px] font-medium"
                    style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}
                  >
                    立即查看
                  </span>
                  <span
                    className="rounded-[calc(var(--c-radius)*0.7)] border px-3 py-1.5 text-[11px]"
                    style={{ borderColor: 'var(--c-border)', color: 'var(--c-fg)' }}
                  >
                    了解更多
                  </span>
                </div>
              </div>

              {/* 模拟文章卡片 */}
              <div className="mt-3 grid gap-2.5">
                <PreviewCard primary={theme.primary} accent={theme.accent} />
                <PreviewCard primary={theme.accent} accent={theme.primary} />
              </div>

              {/* 文字层级示例 */}
              <div
                className="mt-3 rounded-theme border p-3"
                style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
              >
                <p className="text-xs font-semibold" style={{ color: 'var(--c-fg)' }}>
                  标题文字效果
                </p>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                  这是正文与次要文字的对比效果，用于检查可读性与对比度。
                </p>
                <div className="mt-2 flex gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${theme.accent} 16%, transparent)`,
                      color: theme.accent,
                    }}
                  >
                    标签
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${theme.primary} 16%, transparent)`,
                      color: theme.primary,
                    }}
                  >
                    分类
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-theme mt-4 p-4">
            <h3 className="text-sm font-semibold">配色建议</h3>
            <ul className="mt-2 grid gap-1.5 text-xs leading-relaxed text-muted">
              <li>· 主题色与辅助色保持足够反差，避免按钮与标签混在一起。</li>
              <li>· 正文色与背景色的对比度建议不低于 7:1，浅灰底上尤其注意。</li>
              <li>· 卡片表面比背景略亮（浅色模式）或略暗（深色模式）更显层次。</li>
              <li>· 深色模式下建议同时检查一遍所有颜色，再保存。</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 子组件                                                              */
/* ------------------------------------------------------------------ */

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-theme border border-border p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-[calc(var(--c-radius)-2px)] px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === option.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PreviewCard({ primary, accent }: { primary: string; accent: string }) {
  return (
    <div
      className="overflow-hidden rounded-theme border"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
    >
      <div
        className="h-14"
        style={{ background: `linear-gradient(120deg, ${primary}, ${accent})`, opacity: 0.75 }}
      />
      <div className="p-3">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--c-fg)' }}>
          校园新闻标题示例
        </p>
        <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
          摘要文字示例，展示卡片内正文的排版效果。
        </p>
      </div>
    </div>
  );
}
