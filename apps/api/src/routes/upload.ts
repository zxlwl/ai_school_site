/**
 * 媒体上传接口。
 *
 * 两种存储驱动（由环境变量 STORAGE_DRIVER 决定）：
 * - dataurl（默认）：图片转 base64 直接存入数据库。零配置、零成本、不需要任何
 *   对象存储服务，Vercel 与 Cloudflare 均可直接使用。代价是单图体积不宜过大，
 *   因此限制 1.5MB。适合学校官网这类图片量不大的场景。
 * - s3：任意兼容 S3 协议的对象存储（Cloudflare R2 / Backblaze B2 / MinIO / 阿里云 OSS 等）。
 *   本实现刻意不依赖 AWS SDK（体积大且需要 Node API），而是手写 SigV4 签名，
 *   保证在 Workers 上也能跑。R2 等需绑定支付方式的服务并非必须，B2 有免费额度。
 *
 * 无论哪种驱动都会在 media 表留一条记录，便于后台统一管理。
 */

import { Hono } from 'hono'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { media } from '../db/schema'
import { fail, ok, readJson } from '../lib/utils'
import { requireAuth } from '../middleware/auth'
import { uploadToS3, type S3Config } from '../lib/s3'

export const uploadRoutes = new Hono()

uploadRoutes.use('*', requireAuth)

/** dataurl 模式下单张图片的大小上限 */
const MAX_BYTES = 1_500_000

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
])

function getStorageDriver(): 'dataurl' | 's3' {
  const raw = (process.env.STORAGE_DRIVER ?? 'dataurl').toLowerCase()
  return raw === 's3' ? 's3' : 'dataurl'
}

function getS3Config(): S3Config | null {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_BASE_URL,
  } = process.env

  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return null
  }

  return {
    endpoint: S3_ENDPOINT,
    region: S3_REGION || 'auto',
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    publicBaseUrl: S3_PUBLIC_BASE_URL || `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}`,
  }
}

/**
 * 上传图片。
 * 接受两种请求体：
 * - JSON: { filename, mimeType, data }，data 为纯 base64（不含 data: 前缀）
 * - 任意二进制 + Content-Type 头（文件名从 X-Filename 头取）
 */
uploadRoutes.post('/', async (c) => {
  const driver = getStorageDriver()
  let filename = 'image'
  let mimeType = 'image/png'
  let bytes: Uint8Array

  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await readJson<{ filename?: string; mimeType?: string; data?: string }>(c)
    if (!body?.data) return fail(c, 400, 'invalid_body', '缺少图片数据')

    filename = (body.filename ?? 'image').slice(0, 200)
    mimeType = (body.mimeType ?? 'image/png').slice(0, 100)

    // 兼容前端误传的 data:image/png;base64, 前缀
    const base64 = body.data.includes(',') ? body.data.slice(body.data.indexOf(',') + 1) : body.data

    try {
      const binary = atob(base64)
      bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    } catch {
      return fail(c, 400, 'invalid_data', '图片数据不是合法的 base64')
    }
  } else {
    const buffer = await c.req.arrayBuffer()
    bytes = new Uint8Array(buffer)
    mimeType = contentType.split(';')[0].trim() || 'image/png'
    filename = (c.req.header('x-filename') ?? 'image').slice(0, 200)
  }

  if (bytes.byteLength === 0) {
    return fail(c, 400, 'empty_file', '文件为空')
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    return fail(c, 400, 'unsupported_type', `不支持的图片格式：${mimeType}`)
  }

  // s3 模式放宽到 8MB（对象存储不占数据库）
  const limit = driver === 's3' ? 8_000_000 : MAX_BYTES
  if (bytes.byteLength > limit) {
    return fail(
      c,
      413,
      'too_large',
      `图片过大（${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB），上限 ${(limit / 1024 / 1024).toFixed(1)}MB`,
    )
  }

  let url: string

  if (driver === 's3') {
    const config = getS3Config()
    if (!config) {
      return fail(
        c,
        500,
        'storage_not_configured',
        'STORAGE_DRIVER=s3 但缺少 S3_* 环境变量配置',
      )
    }
    try {
      url = await uploadToS3(config, { filename, mimeType, bytes })
    } catch (error) {
      return fail(c, 502, 'upload_failed', `上传到对象存储失败：${(error as Error).message}`)
    }
  } else {
    // dataurl：直接内联进数据库，前台 <img src> 可直接使用
    const base64 = bytesToBase64(bytes)
    url = `data:${mimeType};base64,${base64}`
  }

  const db = getDb()
  const inserted = await db
    .insert(media)
    .values({ filename, url, mimeType, bytes: bytes.byteLength })
    .returning({ id: media.id })

  return ok(c, { id: inserted[0]?.id, url, bytes: bytes.byteLength, driver }, 201)
})

/** 存储驱动能力探测，后台据此提示用户 */
uploadRoutes.get('/config', (c) => {
  const driver = getStorageDriver()
  const configured = driver === 's3' ? getS3Config() !== null : true
  return ok(c, {
    driver,
    configured,
    maxBytes: driver === 's3' ? 8_000_000 : MAX_BYTES,
    allowedMime: [...ALLOWED_MIME],
  })
})

/** 从 URL 反查媒体记录，删除文章时可用于清理引用统计 */
uploadRoutes.get('/lookup', async (c) => {
  const url = c.req.query('url')
  if (!url) return fail(c, 400, 'invalid_query', '缺少 url 参数')

  const db = getDb()
  const rows = await db.select().from(media).where(eq(media.url, url)).limit(1)
  if (rows.length === 0) return fail(c, 404, 'not_found', '未找到对应媒体')

  const row = rows[0]
  return ok(c, { id: row.id, filename: row.filename, url: row.url, bytes: row.bytes })
})

uploadRoutes.get('/', async (c) => {
  const db = getDb()
  const rows = await db.select().from(media).orderBy(desc(media.createdAt)).limit(60)
  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      url: row.url,
      mimeType: row.mimeType,
      bytes: row.bytes,
      createdAt: row.createdAt.toISOString(),
    })),
  )
})

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

/** Uint8Array → base64。不依赖 Buffer，Workers 下同样可用 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000 // 分块避免超长参数导致栈溢出
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
