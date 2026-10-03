/**
 * 极简 S3 客户端（SigV4 签名，PUT Object）。
 *
 * 为什么不直接用 @aws-sdk/client-s3：该库体积大（数 MB）、依赖 Node API，
 * 在 Cloudflare Workers 上无法运行。学校官网只需要「上传一张图」这一件事，
 * 手写签名不到 100 行，且在 Node 与 Workers 下行为一致。
 */

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** 对外可访问的基址，例如 R2 的自定义域或 B2 的公开桶地址 */
  publicBaseUrl: string
}

/* ------------------------------------------------------------------ */
/* 编码辅助                                                            */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  // 复制到独立 ArrayBuffer，避免 SharedArrayBuffer 类型不匹配
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return toHex(await crypto.subtle.digest('SHA-256', copy))
}

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array<ArrayBuffer>> {
  const keyCopy = new Uint8Array(key.length)
  keyCopy.set(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyCopy,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  // 复制到独立 ArrayBuffer，避免 SharedArrayBuffer 类型不匹配
  const copy = new Uint8Array(signature.byteLength)
  copy.set(new Uint8Array(signature))
  return copy
}

/**
 * AWS SigV4 要求对 URI 路径逐段编码，且保留 '/'。
 * encodeURIComponent 不编码 !'()* ，需额外替换，否则签名校验失败。
 */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join('/')
}

/** 生成带随机后缀的对象键，避免同名覆盖 */
export function makeObjectKey(filename: string): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  // 去掉不安全字符，保留扩展名
  const safe = filename.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(-80)
  const rand = Math.random().toString(36).slice(2, 10)
  return `uploads/${yyyy}/${mm}/${Date.now().toString(36)}-${rand}-${safe}`
}

/* ------------------------------------------------------------------ */
/* 上传                                                                */
/* ------------------------------------------------------------------ */

export interface UploadParams {
  filename: string
  mimeType: string
  bytes: Uint8Array
}

/**
 * 以 PUT Object 方式上传，返回可公开访问的 URL。
 * 使用 path-style 寻址（endpoint/bucket/key），兼容 R2、B2、MinIO 等。
 */
export async function uploadToS3(config: S3Config, params: UploadParams): Promise<string> {
  const key = makeObjectKey(params.filename)

  const endpoint = new URL(config.endpoint)
  const host = endpoint.host
  const canonicalUri = encodePath(`/${config.bucket}/${key}`)

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '') // 20260305T120000Z
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = await sha256Hex(params.bytes)

  // 参与签名与发送的头部必须完全一致
  const headers: Record<string, string> = {
    host,
    'content-type': params.mimeType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  const signedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join('')
  const signedHeaders = signedHeaderNames.join(';')

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '', // 无查询参数
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  // 逐级派生签名密钥
  let signingKey = encoder.encode(`AWS4${config.secretAccessKey}`)
  for (const part of [dateStamp, config.region, 's3', 'aws4_request']) {
    signingKey = await hmac(signingKey, part)
  }

  const signature = toHex((await hmac(signingKey, stringToSign)).buffer)
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${endpoint.origin}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: params.bytes as unknown as ReadableStream | ArrayBuffer,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`S3 返回 ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`)
  }

  return `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`
}

/**
 * 删除对象。删除失败不抛错（例如公开桶不允许删除），
 * 由调用方决定是否忽略。
 */
export async function deleteFromS3(config: S3Config, key: string): Promise<boolean> {
  const endpoint = new URL(config.endpoint)
  const host = endpoint.host
  const canonicalUri = encodePath(`/${config.bucket}/${key}`)

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = await sha256Hex('')

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  const signedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaderNames.map((n) => `${n}:${headers[n].trim()}\n`).join('')
  const signedHeaders = signedHeaderNames.join(';')

  const canonicalRequest = ['DELETE', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n')

  let signingKey = encoder.encode(`AWS4${config.secretAccessKey}`)
  for (const part of [dateStamp, config.region, 's3', 'aws4_request']) {
    signingKey = await hmac(signingKey, part)
  }

  const signature = toHex((await hmac(signingKey, stringToSign)).buffer)
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${endpoint.origin}${canonicalUri}`, {
    method: 'DELETE',
    headers: { ...headers, Authorization: authorization },
  })

  return response.ok
}
