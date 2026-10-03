/**
 * 图片上传封装。
 *
 * 放在单独模块里，方便编辑器按需动态 import，也方便其他页面复用。
 * 后端会按 STORAGE_DRIVER 决定落库（data URL）还是推到 S3 兼容存储，
 * 前端只关心拿到一个能直接放进 <img src> 的地址。
 */

import { api } from './api'
import type { UploadResult } from '@school/shared'

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif']

export async function uploadMedia(payload: {
  filename: string
  mimeType: string
  data: string
}): Promise<string> {
  if (!ALLOWED.includes(payload.mimeType)) {
    throw new Error(`不支持的图片格式：${payload.mimeType || '未知'}`)
  }
  const result = await api.upload<UploadResult>(payload)
  return result.url
}
