# 论坛实现方案

> **状态：已实现基础功能。** 本文最初是设计文档，实现完成后已按实际情况校订；
> 文末列出「已实现」与「未实现」的差异，阅读时请以该清单为准。
>
> 前置条件：账号系统已实现（`users` 表 + `school_user` Cookie + 角色/状态字段），
> 论坛直接复用它，不引入第二套用户体系。

---

## 一、先明确边界

学校官网的论坛和「通用论坛」（Discourse、NodeBB 那种）是两类东西。混为一谈会导致方案失控。

| 维度 | 通用论坛 | 本方案（校内交流区） |
|---|---|---|
| 用户来源 | 开放注册 | 开放注册 + 后台可封禁/禁言 |
| 版块 | 用户可建版 | **管理员建版**，数量少（3-8 个） |
| 内容量 | 十万级主题 | 千级主题（一个学校的真实量级） |
| 核心诉求 | 检索、审核、反垃圾 | **可管、可控、不出事** |
| 部署约束 | 独立服务 | 必须和现有 Vercel 函数共存，不加新服务 |

**结论：不引入 Discourse 这类独立系统。** 理由：

1. Vercel 上跑不了常驻进程（Discourse 需要 Ruby + Redis + Sidekiq 常驻）
2. 多一个服务就多一份运维和费用，且免费额度方案基本没有
3. 校内论坛的真实并发极低，现有 Hono + Postgres 完全够

---

## 二、数据模型

在现有 9 张表基础上新增 4 张。命名和风格保持一致（`snake_case` 列、`created_at`/`updated_at`、`status` 用 varchar 不用 enum）。

### 2.1 `forum_boards`（版块）

```sql
create table forum_boards (
  id          serial primary key,
  name        varchar(60)  not null,
  slug        varchar(80)  not null,
  description text,
  color       varchar(16),              -- 和 categories 一样，用于前端点缀
  sort_order  integer      not null default 0,
  -- 谁能发主题：all=所有会员 / member_only=非禁言会员 / staff_only=仅管理员
  post_policy varchar(16)  not null default 'member_only',
  -- 是否需要审核后才公开
  needs_review boolean     not null default false,
  archived    boolean      not null default false,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);
create unique index forum_boards_slug_idx on forum_boards (slug);
```

### 2.2 `forum_topics`（主题帖）

```sql
create table forum_topics (
  id            serial primary key,
  board_id      integer not null references forum_boards(id) on delete cascade,
  author_id     integer not null references users(id) on delete cascade,
  title         varchar(200) not null,
  slug          varchar(220) not null,     -- 用于 /forum/t/:slug 友好链接
  content       text         not null,     -- 首楼正文（冗余一份，避免每次 join）
  status        varchar(16)  not null default 'published',
                                           -- published / pending / hidden / deleted
  pinned        boolean      not null default false,
  locked        boolean      not null default false,   -- 锁定后不能回复
  views         integer      not null default 0,
  reply_count   integer      not null default 0,       -- 冗余计数，列表页避免 count(*)
  last_reply_at timestamptz,                            -- 冗余，用于「最近活跃」排序
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);
create unique index forum_topics_slug_idx    on forum_topics (slug);
create index        forum_topics_board_idx   on forum_topics (board_id, status, last_reply_at desc);
create index        forum_topics_author_idx  on forum_topics (author_id);
create index        forum_topics_status_idx  on forum_topics (status);
```

### 2.3 `forum_posts`（回复）

```sql
create table forum_posts (
  id         serial primary key,
  topic_id   integer not null references forum_topics(id) on delete cascade,
  author_id  integer not null references users(id) on delete cascade,
  content    text    not null,
  status     varchar(16) not null default 'published',  -- published / hidden / deleted
  -- 楼中楼：指向被回复的那条
  reply_to   integer references forum_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index forum_posts_topic_idx  on forum_posts (topic_id, status, created_at);
create index forum_posts_author_idx on forum_posts (author_id);
```

### 2.4 `forum_reports`（举报）

这张表是**校内论坛能不能长期活下去的关键**——没有它，管理员只能靠自己巡逻。

```sql
create table forum_reports (
  id          serial primary key,
  target_type varchar(16) not null,     -- topic / post
  target_id   integer     not null,
  reporter_id integer     not null references users(id) on delete cascade,
  reason      varchar(40) not null,     -- spam / abuse / sensitive / other
  detail      text,
  status      varchar(16) not null default 'open',   -- open / resolved / dismissed
  handled_by  integer references admins(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index forum_reports_status_idx on forum_reports (status, created_at desc);
-- 同一人对同一目标只能举报一次
create unique index forum_reports_uniq_idx on forum_reports (target_type, target_id, reporter_id);
```

### 2.5 为什么不建标签表

现有 `articles` 也没做标签。标签在千级内容量下收益很低，而维护成本（管理界面、去重、脏数据）不低。**先用版块分区 + 搜索**，等真的有跨版块聚合需求再加。

---

## 三、接口设计

全部挂在 `/api/forum`，沿用现有 `ok/fail` 响应格式和 zod 校验。

### 3.1 公开接口（无需登录）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/forum/boards` | 版块列表，含每个版块的主题数/最后活跃 |
| GET | `/api/forum/boards/:slug/topics` | 主题列表，支持 `page` / `sort`(latest\|hot\|new) |
| GET | `/api/forum/topics/:slug` | 主题详情 + 分页回复 |
| GET | `/api/forum/recent` | 全站最新主题（首页「校园交流」区块用） |

### 3.2 会员接口（`requireUser`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/forum/topics` | 发主题 |
| PATCH | `/api/forum/topics/:id` | 编辑自己的主题（可设时限） |
| DELETE | `/api/forum/topics/:id` | 删除自己的主题（软删） |
| POST | `/api/forum/topics/:id/replies` | 回复 |
| PATCH | `/api/forum/posts/:id` | 编辑自己的回复 |
| DELETE | `/api/forum/posts/:id` | 删除自己的回复（软删） |
| POST | `/api/forum/reports` | 举报 |

### 3.3 管理接口（`requireAuth`，写在 `routes/admin-forum.ts`）

| 方法 | 路径 | 角色要求 |
|---|---|---|
| GET | `/api/admin/forum/boards` | viewer 可读 |
| POST/PUT/DELETE | `/api/admin/forum/boards` | editor+ |
| GET | `/api/admin/forum/topics` | viewer 可读（含 pending/hidden） |
| PATCH | `/api/admin/forum/topics/:id` | editor+（置顶/锁定/隐藏/移版） |
| PATCH | `/api/admin/forum/posts/:id` | editor+（隐藏） |
| GET | `/api/admin/forum/reports` | viewer 可读 |
| POST | `/api/admin/forum/reports/:id/resolve` | editor+ |
| POST | `/api/admin/users/:id/mute` | editor+（禁言 7/30 天/永久） |

**注意**：禁言要复用已有的 `users.status = 'muted'`，而不是新增字段。
现有 `requireUser` 只在 `status === 'active'` 时放行写操作——需要在中间件里区分
「读」和「写」：`muted` 用户可以登录、可以浏览、**不能发帖回复**。

---

## 四、关键机制

### 4.1 发帖频率限制

没有这个，一个脚本就能刷满整个论坛。放在**数据库**而不是内存（Vercel 函数实例随时销毁，内存计数无效）。

```sql
-- 查最近 N 分钟的发言数
select count(*) from forum_posts
where author_id = $1 and created_at > now() - interval '10 minutes';
```

阈值建议：**10 分钟内最多 5 帖**（主题 + 回复合计）。超限返回 `429 too_many_requests`。
同一 IP 的注册频率也建议限制（现有 `users` 表加 `register_ip` 可选）。

### 4.2 内容审核的两种模式

| 模式 | 适用 | 做法 |
|---|---|---|
| 先发后审 | 默认，体验好 | 直接 `published`，靠举报 + 管理员巡查 |
| 先审后发 | 敏感时期 / 新版块 | `forum_boards.needs_review = true` → 新帖 `status='pending'`，仅作者和管理员可见 |

**不要默认开先审后发。** 校内论坛本来就没多少人发帖，加了审核会让本来就少的互动归零。

### 4.3 软删除而非物理删除

`status='deleted'` + 列表过滤。理由：学生之间闹矛盾时，删帖证据没了会让处理变得复杂。
物理删除只由管理员在「彻底删除」时执行。

### 4.4 计数冗余的一致性

`reply_count` / `last_reply_at` 是冗余字段。在回复的同一个事务里更新：

```ts
await db.transaction(async (tx) => {
  const [post] = await tx.insert(forumPosts).values({...}).returning()
  await tx.update(forumTopics)
    .set({
      replyCount: sql`${forumTopics.replyCount} + 1`,
      lastReplyAt: new Date(),
    })
    .where(eq(forumTopics.id, topicId))
  return post
})
```

删除回复时反向减一。**不要用定时任务重算**——Vercel 的 cron 免费额度有限，且这种小偏差不值得。

### 4.5 防 XSS

现有文章正文已用 `marked` + `DOMPurify` 处理。论坛回复**必须走同一条管线**。
特别注意：用户可能贴 `<script>`，DOMPurify 默认配置已能拦；但要显式禁掉 `on*` 属性
和 `javascript:` 协议。

### 4.6 搜索

Postgres 自带全文检索够用，不需要 Elasticsearch：

```sql
alter table forum_topics add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content,'')), 'B')
  ) stored;
create index forum_topics_search_idx on forum_topics using gin (search_vector);
```

**关键点**：中文要用 `'simple'` 配置而不是 `'english'`。`'english'` 会把中文整段当一个 token，
搜不到任何东西。`'simple'` 至少能按字符切分做前缀匹配——效果一般但可用。
真要好的中文分词得上 `pg_jieba` 扩展，Neon 免费版未必支持，**先不做**。

---

## 五、前端页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/forum` | `ForumHomePage` | 版块列表 + 最新主题 |
| `/forum/b/:slug` | `BoardPage` | 版块内主题列表，分页 |
| `/forum/t/:slug` | `TopicPage` | 主题详情 + 回复列表 + 回复框 |
| `/forum/new` | `NewTopicPage` | 发主题（需登录） |
| `/admin/forum` | `AdminForum` | 版块管理 |
| `/admin/forum/reports` | `AdminForumReports` | 举报处理 |

复用现有的 `card-theme` / `btn-primary` / `input-theme` / `Field` / `Modal` / `Pagination`，
不引入新的 UI 库。

---

## 六、实施顺序（建议分四批）

| 批次 | 内容 | 产出 | 状态 |
|---|---|---|---|
| 1 | 表结构 + 版块/主题/回复的读写接口 + 基础页面 | 能发帖、能看帖 | ✅ 已完成 |
| 2 | 管理端：版块管理、置顶/锁定/隐藏 | 能管内容 | ✅ 已完成 |
| 3 | 举报 + 禁言 + 频率限制 | 能管人 | ⚠ 部分（禁言/频率限制已完成，举报未做） |
| 4 | 全文搜索 + 楼中楼 + 通知 | 体验完善 | ❌ 未做 |

**每批都能独立上线**，不要一次性憋大版本。

---

## 七、明确不做的

写清楚「不做什么」和「做什么」同样重要，可以防止方案膨胀：

- ❌ 私信系统 —— 校内论坛不需要，且是霸凌/骚扰的高发区，维护成本极高
- ❌ 富文本编辑器 —— 用 Markdown + 预览即可，富文本会带来一堆 HTML 清洗问题
- ❌ 点赞/积分/等级 —— 游戏化机制在校园场景容易变味
- ❌ 图片直接上传 —— 现有 `dataurl` 方案只适合小图标，论坛图片建议先只支持外链，
  或复用 `media` 表 + 对象存储（注意：按 m00009 约束，不能用需信用卡的 R2）
- ❌ 实时推送（WebSocket）—— Vercel 函数不支持长连接，轮询或干脆手动刷新

---

## 八、实现现状（与上述设计的差异）

**已实现：**

| 模块 | 文件 | 说明 |
|---|---|---|
| 数据表 | `apps/api/src/db/schema.ts` | `forum_boards` / `forum_topics` / `forum_posts` 三张表（举报表未建） |
| 公开接口 | `apps/api/src/routes/forum.ts` | `GET /boards`、`GET /boards/:slug/topics`、`GET /topics/:slug`、`GET /recent` |
| 会员接口 | 同上 | `POST /topics`、`PATCH /topics/:id`、`DELETE /topics/:id`、`POST /topics/:id/replies`、`DELETE /posts/:id` |
| 管理接口 | `apps/api/src/routes/admin-forum.ts` | 版块增删改、主题置顶/锁定/隐藏、帖子隐藏 |
| 前端页面 | `apps/web/src/pages/forum/` | `ForumHomePage` / `BoardPage` / `TopicPage` / `NewTopicPage` |
| 管理后台 | `apps/web/src/pages/admin/AdminForum.tsx` | 版块与主题管理 |
| 演示数据 | `scripts/seed-forum-demo.mjs` | 4 个版块 + 6 个主题 + 9 条回复（幂等） |

**与设计不一致的地方（实现时按实际调整）：**

1. **`forum_boards` 没有 `topic_count` / `post_count` 冗余列** —— 版块列表用一次聚合查询算出
   `topicCount` 和 `lastActivityAt`，避免维护冗余计数的写放大。设计文档里的 4.4 节对此做了
   相反的取舍（主题的 `reply_count` 仍保留冗余），因为版块数量少、主题列表才是热查询。
2. **`forum_topics.content` 存首楼正文** —— 详情页无需 join `forum_posts` 拿首楼。
   `forum_posts` 只存回复，因此没有 `floor` 列。
3. **`forum_topics` 有 `slug`** —— 详情页用 `/forum/t/:slug` 而不是 `/forum/t/:id`，
   slug 由标题生成（中文标题会保留中文字符，URL 中显示为百分号编码但地址栏可读）。
4. **频率限制用数据库计数** —— 符合设计文档 4.1 的结论；serverless 下内存计数无效。
5. **待审核（`needsReview`）已实现** —— 版块可开启，开启后新主题 `status='pending'`。

**未实现（设计里有、代码里没有）：**

- `forum_reports` 举报功能（表也没建）
- 全文搜索（`/api/forum/search`）
- 楼中楼（`reply_to` 字段存在但未使用）
- 站内通知

---

## 九、本地试用

```bash
# 灌入演示版块与主题（幂等，可重复执行）
node scripts/seed-forum-demo.mjs

# 演示会员账号
# 用户名：demo_student    密码：demo12345
```

启动后访问 `/forum` 即可看到版块列表；登录后可发帖、回复。

---

## 十、如果要继续做

下一步优先级建议：

1. **举报功能** —— 校园场景的刚需，实现成本低（一张表 + 两个接口），能显著降低管理员的被动巡查压力
2. **全文搜索** —— 注意中文必须用 `to_tsvector('simple', ...)`，用 `'english'` 会把整段中文当成一个 token
3. 楼中楼 —— `reply_to` 已留好，只需前端展示与接口回填
