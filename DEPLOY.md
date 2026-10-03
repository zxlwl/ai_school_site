# 部署指南（Vercel / Cloudflare）

本项目为**前后端分离**架构，但生产环境采用**同域部署**：前端静态文件与 API 都在同一域名下，
前端代码里始终请求相对路径 `/api`，因此**不需要配置任何跨域变量**。

> 部署前请先运行自检：
> ```bash
> node scripts/preflight.mjs
> ```
> 全绿即可部署；有红色阻断项按其提示修正。

---

## 一、部署到 Vercel（推荐，最省事）

### 1. 准备数据库（Neon）

Vercel 的 Serverless 函数**没有 TCP 长连接**，必须使用 HTTP 网关协议的数据库。
[Neon](https://neon.tech) 的免费版即可，无需信用卡。

1. 注册 Neon → 新建 Project（区域建议选 `ap-southeast-1`，离国内近）
2. 在 Dashboard 复制 **Pooled connection string**，形如：
   ```
   postgresql://user:pass@ep-xxx-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   ⚠️ 一定要用带 `-pooler` 的那条，直连串在 Serverless 下容易耗尽连接数。

> 本项目的 `apps/api/src/db/client.ts` 会**自动识别** Neon 域名并切换到 `neon-http` 驱动
> （判定正则 `/neon\.tech|neon\.build/`），其余情况回退到 `postgres.js`。所以只要把
> Neon 连接串填进去就行，无需改动任何代码。

### 2. 初始化数据库表与示例数据

在**本地**执行一次即可（连的就是 Neon 上那个库）：

```bash
npm run db:push    # 建表（幂等，可重复执行）
npm run db:seed    # 写入示例数据（管理员、分类、文章、公告、单页）
```

默认管理员账号 **admin / admin123**，首次登录后系统会强制要求改密码
（新密码不能等于 `admin123`，且至少 8 位）。

### 3. 推送代码到 Git 仓库

```bash
git init
git add .
git commit -m "school site"
git remote add origin <你的仓库地址>
git push -u origin main
```

`.gitignore` 已排除 `node_modules/`、`dist/`、`.env`，**不会泄露密钥**。

### 4. 在 Vercel 导入项目

1. 打开 [vercel.com/new](https://vercel.com/new)，选择你的仓库
2. **Framework Preset 选 `Other`**（仓库根已是 `vercel.json`，配置会被自动读取，
   不要选 Vite —— 那会覆盖 `outputDirectory`）
3. 展开 **Environment Variables**，添加：

   | 变量名 | 值 | 说明 |
   |---|---|---|
   | `DATABASE_URL` | Neon 连接串 | **必填**，用带 `-pooler` 的那条 |
   | `AUTH_SECRET` | 随机 32+ 字符 | **必填**，重新生成，不要复用本地那个 |
   | `CORS_ORIGIN` | 留空 | 同域部署不需要 |
   | `STORAGE_DRIVER` | `dataurl` | 默认值，图片以 base64 存库 |
   | `UPLOAD_MAX_BYTES` | `2097152` | 可选，单图上限 2MB |

   生成 `AUTH_SECRET`：
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. 点击 **Deploy**

### 5. 验证部署

部署完成后访问：

- `https://<你的域名>/` —— 前台首页，应显示「明德中学」及文章列表
- `https://<你的域名>/api/health` —— 应返回
  ```json
  {"data":{"ok":true,"service":"school-site-api","runtime":"node",...}}
  ```
- `https://<你的域名>/admin` —— 后台登录页

> **路由说明**：`vercel.json` 中 `rewrites` 把 `/api/*` 之外的所有路径都指向 `/index.html`，
> 因此 React Router 的前端路由（`/admin`、`/articles/xxx` 等）刷新不会 404。

---

## 二、部署到 Cloudflare Workers

Cloudflare 上「前端」与「后端」需要分别部署，因为 Workers 本身不托管静态资源。
整体思路：**Workers 跑 API，Pages 托管前端并反向代理 `/api` 到 Workers**。

### 1. 部署 API 到 Workers

```bash
cd apps/api
npx wrangler login
npx wrangler secret put DATABASE_URL   # 粘贴 Neon 连接串
npx wrangler secret put AUTH_SECRET    # 粘贴随机密钥
npx wrangler deploy
```

部署成功后会得到一个形如 `https://school-site-api.<你的子域>.workers.dev` 的地址。

`wrangler.toml` 中已开启 `nodejs_compat` 兼容标志（`bcryptjs` 等依赖需要）。

> ⚠️ Workers 无 TCP socket，`DATABASE_URL` **必须**是 Neon 这类 HTTP 网关连接串。
> 图片走默认的 `dataurl` 驱动（存库），**不需要也不使用 R2**，符合「不使用需要信用卡的服务」的要求。

### 2. 部署前端到 Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy apps/web/dist --project-name=school-site
```

然后在 Pages 项目的 **Settings → Functions → Service bindings**（或用 `_routes.json`
配合 `_worker.js`）把 `/api/*` 指向上面的 Worker。

更简单的做法是在 Pages 项目里加一个 `functions/api/[[path]].ts` 转发文件：

```ts
// apps/web/functions/api/[[path]].ts
export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, env.API_ORIGIN)
  return fetch(new Request(target, request))
}
```

并在 Pages 的 **Settings → Environment variables** 里设置 `API_ORIGIN` 为你的 Workers 地址。

### 3. 跨域场景（前端与 API 不同域）

若不想用同域代理，而是让前端直接请求 Workers 域名，则：

1. 构建前端时设置 `VITE_API_BASE=https://school-site-api.xxx.workers.dev/api`
2. 在 Workers 侧设置 `CORS_ORIGIN=https://your-pages-domain.pages.dev`

`apps/api/src/app.ts` 的 CORS 中间件支持逗号分隔多个域名；
`credentials: true` 已开启，因此**不能用 `*`**（设置 `*` 时会回显请求来源，等效放行）。

---

## 三、部署架构说明

```
                    ┌──────────────────────────────┐
   浏览器 ──────────▶│  https://your-domain         │
                    │                              │
                    │  /            → 前端静态文件  │
                    │  /admin       → 前端静态文件  │
                    │  /api/*       → Serverless   │
                    └──────────────┬───────────────┘
                                   │
                            ┌──────▼──────┐
                            │ Neon (HTTP) │
                            └─────────────┘
```

关键文件：

| 文件 | 作用 |
|---|---|
| `vercel.json` | Vercel 构建/输出/重写配置 |
| `api/index.ts` | Vercel Serverless 函数入口（根目录，Vercel 约定） |
| `apps/api/api/index.ts` | 同一入口的另一种路径形式（保留兼容） |
| `apps/api/src/app.ts` | Hono 应用本体，被两个入口共用 |
| `apps/api/src/worker.ts` | Cloudflare Workers 入口 |
| `apps/api/src/db/client.ts` | 按连接串自动选择 neon-http / postgres.js 驱动 |

---

## 四、常见问题

**Q：部署后首页白屏、`/api/health` 500**
检查 `DATABASE_URL` 是否配置。缺失时接口会返回
`{"error":"configuration_error","message":"DATABASE_URL 未配置。..."}`。
在 Vercel 上改完环境变量需要 **Redeploy** 才生效。

**Q：后台登录后立刻跳回登录页**
Cookie 没种上。确认访问的是 `https` 且前后端**同域**；
若跨域，检查 `CORS_ORIGIN` 是否精确匹配前端域名（含 `https://`，不含末尾斜杠）。

**Q：Vercel 构建报 `pnpm: command not found`**
`vercel.json` 的 `installCommand`/`buildCommand` 必须用 `npm`。
本项目已改为 npm，且根 `package.json` 的 `packageManager` 为 `npm@11`。

**Q：Vercel 构建报找不到函数入口**
函数入口必须在**仓库根目录的 `api/` 下**。本项目根 `api/index.ts` 已就位，
它 import 的是 `../apps/api/src/app`，Vercel 打包时会自动追踪该依赖树。

**Q：图片上传失败 / 提示存储未配置**
默认 `STORAGE_DRIVER=dataurl` 会把图片转 base64 存进数据库，单图上限由
`UPLOAD_MAX_BYTES` 控制（默认 2MB）。若需对象存储，可设 `STORAGE_DRIVER=s3`
并配置 `S3_*` 系列变量（兼容任何 S3 协议服务，**不必是 R2**）。

**Q：想改数据库表结构后重新部署**
本地改 `apps/api/src/db/schema.ts` → 跑 `npm run db:push` → 重新部署。

---

## 五、本地开发（部署前的验证）

```bash
# 终端 1：后端 API  → http://localhost:8787
npm run dev:api

# 终端 2：前端      → http://localhost:5173
npm run dev:web
```

`.env` 放在**仓库根目录**（也兼容 `apps/api/.env`，两处同时存在以根目录为准）：

```ini
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
AUTH_SECRET=至少32位随机字符串
CORS_ORIGIN=http://localhost:5173
STORAGE_DRIVER=dataurl
```

Vite 已配置代理：`/api` → `http://localhost:8787`，因此本地开发同样是「同域」，
与生产环境行为一致。
