# 明德中学官网

前后端分离的学校官方网站，含前台展示、会员系统、论坛与完整管理后台。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19 + Vite 8 + React Router 7 + Tailwind CSS v4 |
| 后端 | Hono + Drizzle ORM + PostgreSQL |
| 认证 | bcryptjs + jose（HS256 JWT，httpOnly Cookie） |
| 部署 | Vercel（Build Output API）/ Cloudflare Workers；数据库用 Neon |

## 功能

**前台**

- 文章发布与分类浏览、公告栏、单页（关于我们、联系方式等）
- 站点主题可按后台配置实时换色
- 会员注册 / 登录 / 账号中心（改资料、改密码）

**论坛**

- 多版块、发主题、回复、编辑、删除
- 置顶、锁定、隐藏；可选的发帖先审后发
- 频率限制（数据库计数，适配 serverless）、会员禁言

**后台**（`/admin`，管理员密码登录）

- 文章 / 分类 / 公告 / 单页的增删改查
- 站点外观：预设主题、主色、圆角、字体等
- 留言管理、媒体管理
- 论坛管理：版块增删改、主题置顶/锁定/隐藏
- 账号管理：管理员角色（owner / editor / viewer）与会员管理

## 目录结构

```
apps/
  web/         前端（Vite SPA）
  api/         后端（Hono，同时支持 Node 与 Cloudflare Workers）
packages/
  shared/      前后端共享的类型与工具函数
scripts/       构建、自检、冒烟测试、数据初始化
```

## 本地运行

```bash
npm install

# 配置数据库与密钥
cp .env.example .env      # 然后填入 DATABASE_URL 与 AUTH_SECRET

# 建表并灌入示例数据
npm run db:push
npm run db:seed

# 启动（前端 + 后端同时起）
npm run dev
```

- 前台：http://localhost:5173
- 后台：http://localhost:5173/admin
- 接口：http://localhost:8787/api/health

初次登录用 `admin` / `admin123`，登录后请立即修改密码。
局域网访问（手机、同网段电脑）见 [LOCAL-DEV.md](LOCAL-DEV.md)。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 同时启动前后端，监听 `0.0.0.0` |
| `npm run build` | 完整生产构建，产物在 `.vercel/output/` |
| `npm run typecheck` | 三个包的 TypeScript 检查 |
| `npm run db:push` | 同步表结构到数据库 |
| `npm run db:seed` | 写入示例数据（幂等） |
| `node scripts/preflight.mjs` | 部署前自检 |
| `node scripts/verify-build-output.mjs` | 用纯 Node 加载构建产物并探测路由 |

## 部署

- **Vercel**：见 [DEPLOY.md](DEPLOY.md)。项目用 Build Output API 输出，
  仓库里**没有** `api/` 目录（Vercel 会强制编译它，与我们的产物冲突）。
- **Cloudflare Workers**：`apps/api` 下 `npm run dev:cf` 本地调试，构建产物可直接部署。
  注意不使用任何需要信用卡的服务（如 R2），图片走 `dataurl` 存储。

## 论坛

论坛的实现方案与现状（已实现 / 未实现的差异）见 [FORUM.md](FORUM.md)。

灌入演示数据：

```bash
node scripts/seed-forum-demo.mjs
# 演示会员：demo_student / demo12345
```

## 文档

- [DEPLOY.md](DEPLOY.md) — Vercel 与 Cloudflare 部署、排障
- [LOCAL-DEV.md](LOCAL-DEV.md) — 本地启动、局域网访问、常见问题
- [FORUM.md](FORUM.md) — 论坛设计与实现现状
