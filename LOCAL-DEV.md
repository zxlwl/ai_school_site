# 本地运行指南（含局域网访问）

> 适用于 Windows / macOS / Linux。目标是**一条命令跑起来**，并且同一局域网内的手机、平板、同事电脑都能打开。

---

## 一、准备（只需做一次）

### 1. 装 Node

需要 **Node 20 以上**（本项目 `engines` 写的是 `24.x`，Vercel 上跑 24，本地 20/22/24 都可以）。

```bash
node -v    # v20.x 以上即可
npm -v     # 需要 npm 10+
```

### 2. 装依赖

```bash
cd school-site
npm install
```

> 项目用 npm workspaces 管理三个包（`apps/web`、`apps/api`、`packages/shared`），
> 在**仓库根目录**执行一次 `npm install` 就够了，不要分别进子目录装。

### 3. 配环境变量

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

然后编辑 `.env`，**只需填两个值**：

```ini
# 1) 数据库连接串。免费的 Neon：https://neon.tech
#    注册 → 建项目 → Dashboard 复制 Connection string
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# 2) 会话密钥，随便生成一串随机字符，至少 16 位
#    生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_SECRET=把上面命令输出的那串粘贴到这里

# 3) 本地开发时填前端地址
CORS_ORIGIN=http://localhost:5173
```

> ⚠️ `.env` 已在 `.gitignore` 里，不会被提交。**不要把 `AUTH_SECRET` 提交到 Git**。

### 4. 建表 + 灌示例数据

```bash
npm run db:push     # 建表（可重复执行，不会报错）
npm run db:seed     # 写入示例文章、公告、默认主题、管理员账号
```

灌完后默认管理员是 `admin` / `admin123`，**第一次登录后请立刻改密码**。

---

## 二、启动

```bash
npm run dev
```

你会看到：

```
  ────────────────────────────────────────────────────────
   开发环境已启动

   本机访问：
     前端  http://localhost:5173
     接口  http://localhost:8787/api/health

   局域网访问（手机 / 同事电脑）：
     http://192.168.1.23:5173

   注意：前端页面走的是 /api 相对路径，Vite 会代理到本机 8787 端口，
   所以别人访问时不需要额外配置，直接打开上面的地址即可。

   按 Ctrl+C 停止全部服务。
  ────────────────────────────────────────────────────────
```

- **前台**：http://localhost:5173
- **后台**：http://localhost:5173/admin （用 `admin` / `admin123` 登录）
- **接口直连**：http://localhost:8787/api/health

`npm run dev` 会同时启动 API 和前端，按 `Ctrl+C` 一起停掉。

---

## 三、局域网访问（手机上看效果）

这是本项目的常见需求：**想让同学/同事/领导用手机打开看看**。

### 已经自动处理好的部分

`npm run dev` 启动时：

1. **API 监听 `0.0.0.0`** —— 不只是 localhost，局域网其他机器能连
2. **Vite 设了 `host: true`** —— 同理
3. **Vite 放开了 `allowedHosts`** —— 否则用 IP 访问会被 Vite 拦下，
   报 `Blocked request. This host is not allowed.`
4. **前端走 `/api` 相对路径 + Vite 代理** —— 别人访问 `http://你的IP:5173` 时，
   接口请求会被代理回你本机的 8787，**不需要对方做任何配置**

所以你只需要：**把启动日志里打印的 `http://192.168.x.x:5173` 发给他们。**

### 怎么找到自己的局域网 IP

启动日志里已经打印了。也可以手动查：

```bash
# Windows
ipconfig | findstr IPv4

# macOS
ipconfig getifaddr en0

# Linux
hostname -I
```

### 打不开怎么办

按顺序排查这三条，基本能解决 95% 的情况：

| 现象 | 原因 | 解决 |
|---|---|---|
| 手机连不上，电脑上 localhost 正常 | 防火墙挡了 | Windows 首次运行会弹「允许访问」，选**专用网络**并允许；或手动在「Windows 防火墙 → 允许应用」里放行 Node |
| 手机和电脑不在同一网络 | 手机连的是 5G/4G | 让手机连同一个 Wi-Fi |
| 显示 `Blocked request. This host is not allowed.` | Vite 的 Host 校验 | 本项目已设 `allowedHosts: true`；若你改过配置，把它加回来 |

> 公司/学校网络常开「客户端隔离」（AP Isolation），设备之间互相不能访问。
> 这种情况换手机热点试一下就能确认。

### 只想自己看，不想让别人访问

```bash
# macOS / Linux
HOST=127.0.0.1 npm run dev

# Windows PowerShell
$env:HOST="127.0.0.1"; npm run dev
```

---

## 四、常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 同时启动 API + 前端（推荐） |
| `npm run dev:api` | 只启动 API（调试接口时用） |
| `npm run dev:web` | 只启动前端（API 已在别处跑着时用） |
| `npm run build` | 完整生产构建（含 Vercel 产物） |
| `npm run typecheck` | 三个包全量类型检查 |
| `npm run db:push` | 同步表结构（幂等） |
| `npm run db:seed` | 灌示例数据 |

---

## 五、改了数据库结构之后

改 `apps/api/src/db/schema.ts` 之后，有两种方式让步数据库跟上：

```bash
# 方式一：直接同步（本项目用这个，脚本是手写幂等 SQL，跨库通用）
#   需要同时在 apps/api/scripts/push.ts 里补上对应语句
npm run db:push
```

> 本项目**不用** `drizzle-kit migrate` 那套迁移文件。`db:push` 执行的是
> `apps/api/scripts/push.ts` 里手写的 `create table if not exists` / `alter table ... add column if not exists`，
> 任何 Postgres 都能跑，反复执行不报错。代价是**加字段必须手动改这个脚本**。

---

## 六、常见问题

**Q：`npm run dev` 报端口被占用？**
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <上面查到的PID> /F

# macOS / Linux
lsof -ti:5173 | xargs kill -9
```
`vite.config.ts` 里设了 `strictPort: true`，端口被占会直接报错而不是偷偷换一个——
这是故意的，否则日志里打印的地址就是错的。

**Q：接口全部 404 / 前端显示「无法加载站点」？**
先直接访问 http://localhost:8787/api/health 看返回什么：
- 返回 JSON 且 `database: "连接正常"` → API 没问题，检查前端代理
- 返回 503 且提示缺 `DATABASE_URL` → `.env` 没配或没被读到
- 根本连不上 → API 没启动，看 `npm run dev` 的日志里有没有红色报错

**Q：登录后台提示密码错误？**
种子数据里的 `admin123` 只在首次 `db:seed` 且该账号未改过密码时有效。
如果之前改过，用 `npm run db:seed` 重灌（会重置成 `admin` / `admin123`）。

**Q：PowerShell 里中文显示成乱码？**
这是 PowerShell 控制台的编码显示问题，不影响程序本身。
想修的话在启动前执行 `chcp 65001`。

---

## 七、部署到线上

本地跑通之后，部署请看 [DEPLOY.md](./DEPLOY.md)——里面有 Vercel 和 Cloudflare 两套完整流程，
以及本项目踩过的那些坑（函数路由、模块格式、运行时版本等）。
