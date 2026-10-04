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

**Q：部署后首页显示「无法加载站点 / 没能连接到后端 API」**
说明前端起来了但函数报错。**先在浏览器直接访问 `https://你的域名/api/health`**，
那里会返回真实错误原因（前端那句提示是兜底文案，会掩盖细节）。常见原因：

| `/api/health` 返回 | 原因 | 解决 |
|---|---|---|
| `configuration_error` / 500 且提到 `DATABASE_URL 未配置` | 环境变量没生效 | Vercel 上改完环境变量**必须 Redeploy** |
| `Cannot find module '@school/shared'` | 共享包导出的是裸 TS，Node 运行时执行不了 | 本项目已修复（`packages/shared` 编译出 `dist/index.js`）；若你改过 `build` 脚本，确认它包含 `build:shared` |
| 404 | 函数入口没被打包 | 确认根目录存在 `api/index.ts`，且 `vercel.json` 的 `functions` 指向它 |
| 连接超时 / `ECONNREFUSED` | `DATABASE_URL` 不是 Neon HTTP 网关串 | 换成带 `-pooler` 的 Neon 连接串（Vercel 函数无 TCP 长连接） |

本地可用 `node scripts/preflight.mjs` 提前发现前两类问题。

**Q：后台登录后立刻跳回登录页**
Cookie 没种上。确认访问的是 `https` 且前后端**同域**；
若跨域，检查 `CORS_ORIGIN` 是否精确匹配前端域名（含 `https://`，不含末尾斜杠）。

**Q：Vercel 构建报 `pnpm: command not found`**
`vercel.json` 的 `installCommand`/`buildCommand` 必须用 `npm`。
本项目已改为 npm，且根 `package.json` 的 `packageManager` 为 `npm@11`。

**Q：Vercel 导入页面提示「Multiple applications detected」并让你选 Services**
这是 Vercel 扫到 `apps/api` 和 `apps/web` 两个子目录后的**误判**。
把 **Application Preset 改成 `Other`**（不要选 Services，也不要点任何一个
"Import single project"）——改成 Other 后 Vercel 才会读取仓库根的 `vercel.json`。
若按 Services 拆成两个项目，Cookie 会因跨域失效，登录一直失败。

**Q：图片上传失败 / 提示存储未配置**
默认 `STORAGE_DRIVER=dataurl` 会把图片转 base64 存进数据库，单图上限由
`UPLOAD_MAX_BYTES` 控制（默认 2MB）。若需对象存储，可设 `STORAGE_DRIVER=s3`
并配置 `S3_*` 系列变量（兼容任何 S3 协议服务，**不必是 R2**）。

**Q：修改 `packages/shared` 后前端或后端行为没变**
`packages/shared` 现在会先编译到 `dist/index.js`（后端运行时需要真实 JS）。
改完源码跑 `npm run build:shared`，或直接 `npm run build`（已包含该步骤）。

**Q：改数据库表结构后怎么重新部署**
本地改 `apps/api/src/db/schema.ts` → 跑 `npm run db:push` → 重新部署。

**Q：页面能打开，但首页显示「无法加载站点」，所有接口都 404**

这是本项目踩过的最隐蔽的坑，**根因在 Vercel 的函数发现机制**，不在你的配置。

*现象*：前端构建成功、页面正常渲染，但 `/api/health` 返回 `404 NOT_FOUND`，
首页显示「无法加载站点 / 没能连接到后端 API」。部署日志**看起来是成功的**：

```
Build Completed in /vercel/output [18s]
Deploying outputs...
Deployment completed
```

*根因*：Vercel 一旦发现根目录的 `api/index.ts`，就会用它**自带的 TypeScript
环境**去编译这个入口**以及它 import 的整条依赖树**，且强制
`moduleResolution=node16`。而本项目后端源码使用无扩展名相对导入
（如 `from '../lib/utils'`），在 node16 下会报：

```
error TS2835: Relative import paths need explicit file extensions in
ECMAScript imports when '--moduleResolution' is 'node16'
```

关键在于：**这个错误不会中断构建**。Vercel 依然打印 `Build Completed` 和
`Deployment completed`，只是把函数打包那一步**静默跳过**了 —— 于是
`/api/*` 全部 404，而日志里没有任何醒目的失败提示。

*本项目的解法（已内置）*：**仓库里完全不放 `api/` 目录**，且构建期不执行任何
原生二进制。函数由 `scripts/build-api.mjs` 直接产出到 `.vercel/output/`。

| 文件 | 角色 |
|---|---|
| `apps/api/tsconfig.build.json` | 把后端 TS 编译成真实 `.js` 到 `apps/api/dist/` |
| `scripts/build-api.mjs` | 纯 Node 搬运：编译产物 → `.vercel/output/`，补扩展名、带运行时依赖 |
| `.vercel/output/functions/index.func/` | 函数（多文件 + `node_modules/`），由脚本生成，**不入库** |

> **为什么不再用 esbuild 打成单文件？**
> esbuild 是原生二进制包，构建时要派生子进程执行平台相关的可执行文件
> （`@esbuild/linux-x64`）。在 Vercel 构建机上这条路径**反复静默失败**：
> 日志停在 `> node scripts/build-api.mjs` 之后一片空白，既没有错误输出、
> 也拿不到退出码，本地却完全无法复现。
> 现在整条链路只有 `tsc`（纯 JS）+ Node 文件操作，构建期不碰任何原生二进制。

*你要做什么*：正常情况下**什么都不用做** —— 根 `npm run build` 已串入
`build:api`，Vercel 构建时自动生成产物。只需在改完后端代码后记得重新部署。

*如何自查*：

```bash
node scripts/preflight.mjs           # 6 段自检，覆盖整条产物链
node scripts/verify-build-output.mjs # 验收 .vercel/output/（目录、路由次序、函数调用）
```

> 为什么必须用**纯 Node** 验收，而不是 `tsx`：`tsx` 会即时编译 TS，
> 从而掩盖「运行时拿到裸 `.ts` 引用」这类问题。本项目正是因此误判过一次。

---

**Q：构建日志显示 Ready，但日志里「0 个函数」，`/api/*` 全部 404**

这是本项目踩过的**第二个**坑，比 TS2835 更隐蔽。

*根因*：`vercel.json` 里同时存在 `buildCommand` + `outputDirectory` +
`framework: null` 时，Vercel 会把项目当作**纯静态站点**：跑完 `buildCommand`、
把 `outputDirectory` 整体上传，然后**完全跳过 `api/` 目录的函数发现**。
所以函数压根没被注册，日志里自然「0 个函数」，而且不报任何错。

*解法*：改用 **Build Output API v3** —— 由构建脚本自己产出 `.vercel/output/`，
在其中显式声明函数与路由，Vercel 只需照单执行，不再依赖自动发现。

产物结构（全部由 `scripts/build-api.mjs` 生成）：

```
.vercel/output/
├── config.json                          # 路由：filesystem → /api/* → SPA 兜底
├── functions/index.func/
│   ├── .vc-config.json                  # runtime: nodejs20.x, launcherType: Nodejs
│   ├── index.mjs                        # 入口薄壳：handle(app)
│   ├── app.js  routes/…  lib/…  db/…    # apps/api/dist 的编译产物
│   └── node_modules/                    # 9 个运行时依赖（含手写的 @school/shared 副本）
└── static/                              # 前端产物（必须显式复制！）
    ├── index.html
    └── assets/...
```

因此 `vercel.json` 现在只剩三行有效配置（`buildCommand` / `installCommand` /
`framework`），`outputDirectory`、`rewrites`、`functions` 全部移交 `config.json`。

> **三个容易漏掉的点**
>
> 1. **前端必须显式复制进 `static/`**。切到 Build Output API 后
>    `outputDirectory` 不再生效，而 `{ handle: 'filesystem' }` 只查
>    `.vercel/output/static/`。漏掉这步的后果是：函数能跑，但整站空白。
> 2. **构建顺序**：`build:shared` → `build:api`（tsc 编译）→ **web build** →
>    `node scripts/build-api.mjs`。最后一步要读 `apps/web/dist` 填充 `static/`。
> 3. **相对导入必须带 `.js` 后缀**。源码里 31 处相对导入都没写扩展名，而 Node
>    ESM 强制要求。`build-api.mjs` 搬运时会统一重写补上 —— 这是它存在的主要理由。

路由次序也不能错：`filesystem` 必须在 `/api/*` 之前（否则静态资源被函数抢走），
`/api/*` 必须在 SPA 兜底之前（否则接口被 SPA 吞掉、永远返回 HTML）。
`scripts/verify-build-output.mjs` 会校验这三者的顺序。


*判断 Vercel 是否真的跳过了函数*：部署日志里搜 `TS2835`。
若有 → 说明仓库里又出现了 `api/` 目录，Vercel 重新介入了 TS 编译，把它删掉。

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
