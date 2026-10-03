/**
 * Markdown 渲染 — marked 解析 + DOMPurify 消毒。
 *
 * 安全说明：文章与单页正文由管理员撰写，但仍经过 DOMPurify 过滤，
 * 防止管理员口令泄露后攻击者投放 XSS 脚本影响访客。
 * 允许 data: 图片，因为默认存储驱动会把上传的图片内联为 data URL。
 */

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { cn } from './ui'

marked.setOptions({
  gfm: true,
  breaks: true,
})

/** 为标题生成稳定的锚点 id，用于文章目录 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function renderMarkdown(source: string): string {
  if (!source) return ''

  const raw = marked.parse(source, { async: false }) as string

  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel', 'id', 'loading'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
}

/** 处理外链：新窗口打开并加上 rel 保护 */
function hardenLinks(html: string): string {
  return html.replace(/<a\s+([^>]*href=["']https?:\/\/[^"']*["'][^>]*)>/gi, (match, attrs: string) => {
    let result = match
    if (!/target=/i.test(attrs)) result = result.replace('<a ', '<a target="_blank" ')
    if (!/rel=/i.test(attrs)) result = result.replace('<a ', '<a rel="noopener noreferrer" ')
    return result
  })
}

/** 从 Markdown 中提取 h2/h3 目录 */
export interface TocItem {
  id: string
  text: string
  level: number
}

const CODE_FENCE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g
const INLINE_CODE = /`[^`\n]*`/g

export function extractToc(source: string): TocItem[] {
  if (!source) return []
  // 剔除代码块与行内代码，避免把代码里的 # 注释误判为标题
  const cleaned = source.replace(CODE_FENCE, '').replace(INLINE_CODE, '')
  const items: TocItem[] = []
  const used = new Map<string, number>()

  for (const line of cleaned.split('\n')) {
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = match[2].replace(/[*_`[\]]/g, '').trim()
    if (!text) continue
    let id = slugifyHeading(text) || `section-${items.length + 1}`
    const seen = used.get(id) ?? 0
    used.set(id, seen + 1)
    if (seen > 0) id = `${id}-${seen + 1}`
    items.push({ id, text, level: match[1].length })
  }
  return items
}

/** 给渲染后的 HTML 标题补上锚点 id */
function attachHeadingIds(html: string): string {
  const used = new Map<string, number>()
  return html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (match, level: string, attrs = '', inner: string) => {
    if (/\bid=/i.test(attrs)) return match
    const text = inner.replace(/<[^>]+>/g, '').trim()
    let id = slugifyHeading(text) || `section`
    const seen = used.get(id) ?? 0
    used.set(id, seen + 1)
    if (seen > 0) id = `${id}-${seen + 1}`
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`
  })
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => {
    if (!source) return ''
    // 空段落（只含 &nbsp; 的 <p>）会让排版出现多余空隙，清掉
    return hardenLinks(attachHeadingIds(renderMarkdown(source))).replace(
      /<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi,
      '',
    )
  }, [source])

  if (!html) return null

  return <div className={cn('prose-theme', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

/** 纯文本摘要（用于 meta description、分享卡片） */
export function toPlainText(markdown: string, maxLength = 160): string {
  const text = markdown
    .replace(CODE_FENCE, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}
