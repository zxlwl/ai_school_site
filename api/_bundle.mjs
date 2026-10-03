/* 由 scripts/build-api.mjs 自动生成，请勿手动编辑。请改 apps/api/src/ 下的源码后重新运行 npm run build:api。 */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/shared/dist/index.js
var dist_exports = {};
__export(dist_exports, {
  ANNOUNCEMENT_LEVELS: () => ANNOUNCEMENT_LEVELS,
  ANNOUNCEMENT_LEVEL_LABEL: () => ANNOUNCEMENT_LEVEL_LABEL,
  COLOR_MODE_LABEL: () => COLOR_MODE_LABEL,
  CONTAINER_PX: () => CONTAINER_PX,
  CONTAINER_WIDTH_LABEL: () => CONTAINER_WIDTH_LABEL,
  CONTENT_STATUSES: () => CONTENT_STATUSES,
  CONTENT_STATUS_LABEL: () => CONTENT_STATUS_LABEL,
  DEFAULT_SETTINGS: () => DEFAULT_SETTINGS,
  FONT_CHOICE_LABEL: () => FONT_CHOICE_LABEL,
  FONT_STACK: () => FONT_STACK,
  RADIUS_PX: () => RADIUS_PX,
  RADIUS_SCALE_LABEL: () => RADIUS_SCALE_LABEL,
  THEME_PRESETS: () => THEME_PRESETS,
  deriveExcerpt: () => deriveExcerpt,
  formatDate: () => formatDate,
  formatDateCN: () => formatDateCN,
  formatRelative: () => formatRelative,
  slugify: () => slugify
});
function slugify(input) {
  return input.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
function deriveExcerpt(markdown, maxLength = 120) {
  const plain = markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/[*_~>|-]/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}\u2026` : plain;
}
function formatDate(value) {
  if (!value)
    return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime()))
    return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatDateCN(value) {
  if (!value)
    return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime()))
    return "";
  return `${date.getFullYear()}\u5E74${date.getMonth() + 1}\u6708${date.getDate()}\u65E5`;
}
function formatRelative(value) {
  if (!value)
    return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime()))
    return "";
  const diff = Date.now() - date.getTime();
  const minute = 6e4;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute)
    return "\u521A\u521A";
  if (diff < hour)
    return `${Math.floor(diff / minute)} \u5206\u949F\u524D`;
  if (diff < day)
    return `${Math.floor(diff / hour)} \u5C0F\u65F6\u524D`;
  if (diff < 30 * day)
    return `${Math.floor(diff / day)} \u5929\u524D`;
  return formatDate(date);
}
var CONTENT_STATUSES, CONTENT_STATUS_LABEL, ANNOUNCEMENT_LEVELS, ANNOUNCEMENT_LEVEL_LABEL, THEME_PRESETS, RADIUS_SCALE_LABEL, FONT_CHOICE_LABEL, CONTAINER_WIDTH_LABEL, COLOR_MODE_LABEL, RADIUS_PX, CONTAINER_PX, FONT_STACK, DEFAULT_SETTINGS;
var init_dist = __esm({
  "packages/shared/dist/index.js"() {
    "use strict";
    CONTENT_STATUSES = ["draft", "published"];
    CONTENT_STATUS_LABEL = {
      draft: "\u8349\u7A3F",
      published: "\u5DF2\u53D1\u5E03"
    };
    ANNOUNCEMENT_LEVELS = ["info", "important", "urgent"];
    ANNOUNCEMENT_LEVEL_LABEL = {
      info: "\u666E\u901A",
      important: "\u91CD\u8981",
      urgent: "\u7D27\u6025"
    };
    THEME_PRESETS = [
      {
        id: "academic-blue",
        name: "\u5B66\u9662\u84DD",
        description: "\u6C89\u7A33\u4E13\u4E1A\uFF0C\u9002\u5408\u7EFC\u5408\u6027\u5B66\u6821",
        colors: {
          primary: "#2563eb",
          primaryForeground: "#ffffff",
          accent: "#0ea5e9",
          background: "#f8fafc",
          surface: "#ffffff",
          foreground: "#0f172a",
          muted: "#64748b",
          border: "#e2e8f0"
        }
      },
      {
        id: "emerald",
        name: "\u9752\u85E4\u7EFF",
        description: "\u6E05\u65B0\u81EA\u7136\uFF0C\u5BCC\u6709\u751F\u547D\u529B",
        colors: {
          primary: "#059669",
          primaryForeground: "#ffffff",
          accent: "#14b8a6",
          background: "#f7fdfa",
          surface: "#ffffff",
          foreground: "#062c22",
          muted: "#5b7c73",
          border: "#d7ebe4"
        }
      },
      {
        id: "crimson",
        name: "\u6821\u5FBD\u7EA2",
        description: "\u4F20\u7EDF\u539A\u91CD\uFF0C\u4EEA\u5F0F\u611F\u5F3A",
        colors: {
          primary: "#b91c1c",
          primaryForeground: "#ffffff",
          accent: "#f59e0b",
          background: "#fdf9f8",
          surface: "#ffffff",
          foreground: "#2b1313",
          muted: "#7c6a68",
          border: "#ecdcd9"
        }
      },
      {
        id: "violet",
        name: "\u521B\u65B0\u7D2B",
        description: "\u73B0\u4EE3\u79D1\u6280\uFF0C\u9002\u5408\u7406\u5DE5\u9662\u6821",
        colors: {
          primary: "#7c3aed",
          primaryForeground: "#ffffff",
          accent: "#ec4899",
          background: "#faf8ff",
          surface: "#ffffff",
          foreground: "#1e1333",
          muted: "#6b6183",
          border: "#e6e0f5"
        }
      },
      {
        id: "slate",
        name: "\u6781\u7B80\u7070",
        description: "\u514B\u5236\u5185\u655B\uFF0C\u7A81\u51FA\u5185\u5BB9\u672C\u8EAB",
        colors: {
          primary: "#334155",
          primaryForeground: "#ffffff",
          accent: "#0ea5e9",
          background: "#f8fafc",
          surface: "#ffffff",
          foreground: "#0f172a",
          muted: "#64748b",
          border: "#e2e8f0"
        }
      },
      {
        id: "amber",
        name: "\u6696\u9633\u6A59",
        description: "\u6E29\u6696\u4EB2\u5207\uFF0C\u9002\u5408\u4E2D\u5C0F\u5B66",
        colors: {
          primary: "#ea580c",
          primaryForeground: "#ffffff",
          accent: "#eab308",
          background: "#fffbf5",
          surface: "#ffffff",
          foreground: "#2d1a0b",
          muted: "#7d6a58",
          border: "#f2e5d7"
        }
      }
    ];
    RADIUS_SCALE_LABEL = {
      none: "\u76F4\u89D2",
      small: "\u5C0F\u5706\u89D2",
      medium: "\u4E2D\u5706\u89D2",
      large: "\u5927\u5706\u89D2"
    };
    FONT_CHOICE_LABEL = {
      system: "\u7CFB\u7EDF\u9ED8\u8BA4",
      sans: "\u65E0\u886C\u7EBF",
      serif: "\u886C\u7EBF\uFF08\u66F4\u5B66\u672F\uFF09",
      mono: "\u7B49\u5BBD"
    };
    CONTAINER_WIDTH_LABEL = {
      narrow: "\u7A84\uFF08\u9605\u8BFB\u53CB\u597D\uFF09",
      normal: "\u6807\u51C6",
      wide: "\u5BBD\uFF08\u4FE1\u606F\u5BC6\u96C6\uFF09"
    };
    COLOR_MODE_LABEL = {
      light: "\u59CB\u7EC8\u6D45\u8272",
      dark: "\u59CB\u7EC8\u6DF1\u8272",
      auto: "\u8DDF\u968F\u7CFB\u7EDF"
    };
    RADIUS_PX = {
      none: "0px",
      small: "0.375rem",
      medium: "0.75rem",
      large: "1.25rem"
    };
    CONTAINER_PX = {
      narrow: "56rem",
      normal: "72rem",
      wide: "88rem"
    };
    FONT_STACK = {
      system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      sans: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", ui-sans-serif, sans-serif',
      serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, ui-serif, serif',
      mono: '"JetBrains Mono", "Cascadia Code", ui-monospace, "Microsoft YaHei", monospace'
    };
    DEFAULT_SETTINGS = {
      siteName: "\u660E\u5FB7\u4E2D\u5B66",
      siteTagline: "\u660E\u5FB7\u7B03\u5B66 \xB7 \u77E5\u884C\u5408\u4E00",
      siteDescription: "\u660E\u5FB7\u4E2D\u5B66\u5B98\u65B9\u7F51\u7AD9\uFF0C\u53D1\u5E03\u6821\u56ED\u65B0\u95FB\u3001\u901A\u77E5\u516C\u544A\u4E0E\u6559\u5B66\u52A8\u6001\u3002",
      logoText: "\u660E\u5FB7",
      faviconUrl: null,
      contactEmail: "office@example.edu.cn",
      contactPhone: "010-0000 0000",
      contactAddress: "\u67D0\u67D0\u5E02\u67D0\u67D0\u533A\u67D0\u67D0\u8DEF 1 \u53F7",
      footerText: "\xA9 \u660E\u5FB7\u4E2D\u5B66 \xB7 \u4FDD\u7559\u6240\u6709\u6743\u5229",
      icpBeian: "",
      showAnnouncementBar: true,
      showFeaturedArticles: true,
      featuredCount: 3,
      showCategories: true,
      showPages: true,
      theme: {
        preset: "academic-blue",
        ...THEME_PRESETS[0].colors,
        radius: "medium",
        fontFamily: "system",
        containerWidth: "normal",
        colorMode: "light"
      },
      socialLinks: []
    };
  }
});

// api/vercel-entry.ts
import { handle } from "hono/vercel";

// apps/api/src/app.ts
import { Hono as Hono5 } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

// apps/api/src/routes/admin.ts
init_dist();
import { Hono } from "hono";
import { and, asc, count, desc, eq as eq2, ilike, or, sql } from "drizzle-orm";

// apps/api/src/db/client.ts
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// apps/api/src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  admins: () => admins,
  announcements: () => announcements,
  articles: () => articles,
  categories: () => categories,
  media: () => media,
  messages: () => messages,
  pages: () => pages,
  settings: () => settings
});
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    /** bcrypt 哈希，绝不存明文 */
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 64 }).notNull().default("\u7BA1\u7406\u5458"),
    /** 仍使用初始密码时为 true，后台会持续提示修改 */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("admins_username_idx").on(table.username)]
);
var categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 16 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)]
);
var articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    content: text("content").notNull().default(""),
    excerpt: text("excerpt"),
    coverImage: text("cover_image"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null"
    }),
    /** 'draft' | 'published' */
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    views: integer("views").notNull().default(0),
    author: varchar("author", { length: 100 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("articles_slug_idx").on(table.slug),
    index("articles_status_idx").on(table.status),
    index("articles_category_idx").on(table.categoryId),
    index("articles_published_idx").on(table.publishedAt)
  ]
);
var announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull().default(""),
    /** 'info' | 'important' | 'urgent' */
    level: varchar("level", { length: 16 }).notNull().default("info"),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    pinned: boolean("pinned").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("announcements_status_idx").on(table.status),
    index("announcements_pinned_idx").on(table.pinned)
  ]
);
var pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    /** 页面摘要，用于列表与 SEO 描述 */
    summary: text("summary"),
    content: text("content").notNull().default(""),
    status: varchar("status", { length: 16 }).notNull().default("published"),
    showInNav: boolean("show_in_nav").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("pages_slug_idx").on(table.slug)]
);
var settings = pgTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  /** 完整 SiteSettings JSON，读取时与默认值深合并，保证向前兼容 */
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    url: text("url").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    bytes: integer("bytes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("media_created_idx").on(table.createdAt)]
);
var messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 200 }),
    phone: varchar("phone", { length: 50 }),
    subject: varchar("subject", { length: 255 }),
    content: text("content").notNull(),
    /** 是否已在后台处理 */
    handled: boolean("handled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("messages_handled_idx").on(table.handled)]
);

// apps/api/src/db/client.ts
var cached = null;
function isWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
function resolveDriver(url) {
  if (/neon\.tech|neon\.build/.test(url)) return "neon";
  return "postgres-js";
}
function getDb(url) {
  if (cached && !url) return cached;
  const connectionString = url ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL \u672A\u914D\u7F6E\u3002\u8BF7\u5728 .env\uFF08\u672C\u5730\uFF09\u6216\u5E73\u53F0\u73AF\u5883\u53D8\u91CF\uFF08Vercel / Cloudflare\uFF09\u4E2D\u8BBE\u7F6E Postgres \u8FDE\u63A5\u4E32\u3002"
    );
  }
  const driver = resolveDriver(connectionString);
  if (driver === "neon") {
    const client2 = neon(connectionString);
    const db2 = drizzleNeonHttp(client2, { schema: schema_exports });
    if (!url) cached = db2;
    return db2;
  }
  if (isWorkersRuntime()) {
    throw new Error(
      "\u5F53\u524D\u90E8\u7F72\u5728 Cloudflare Workers\uFF0C\u4F46 DATABASE_URL \u4E0D\u662F Neon \u8FDE\u63A5\u4E32\u3002Workers \u65E0\u6CD5\u5EFA\u7ACB TCP \u8FDE\u63A5\uFF0C\u8BF7\u6539\u7528 Neon\uFF08\u514D\u8D39\u7248\u65E0\u9700\u4FE1\u7528\u5361\uFF09\u6216\u5176\u5B83 HTTP \u517C\u5BB9\u7684 Postgres \u670D\u52A1\u3002"
    );
  }
  const client = postgres(connectionString, {
    max: 1,
    // serverless 场景下每实例一个连接即可，避免打爆数据库连接数
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
    // 兼容 Supabase / PgBouncer 事务模式
  });
  const db = drizzlePostgresJs(client, { schema: schema_exports });
  if (!url) cached = db;
  return db;
}

// apps/api/src/lib/settings-service.ts
init_dist();
import { eq } from "drizzle-orm";
var SETTINGS_KEY = "site";
function deepMerge(base, patch) {
  if (patch === null || patch === void 0) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return patch;
  if (typeof base !== "object" || typeof patch !== "object") return patch;
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = base[key];
    result[key] = current && typeof current === "object" && !Array.isArray(current) ? deepMerge(current, value) : value;
  }
  return result;
}
function sanitize(input) {
  const hex = /^#[0-9a-fA-F]{3,8}$/;
  const color = (value, fallback) => typeof value === "string" && hex.test(value.trim()) ? value.trim() : fallback;
  const merged = deepMerge(DEFAULT_SETTINGS, input);
  const theme = merged.theme;
  return {
    ...merged,
    siteName: String(merged.siteName || DEFAULT_SETTINGS.siteName).slice(0, 100),
    siteTagline: String(merged.siteTagline ?? "").slice(0, 200),
    siteDescription: String(merged.siteDescription ?? "").slice(0, 500),
    logoText: String(merged.logoText ?? "").slice(0, 20),
    featuredCount: Math.min(12, Math.max(1, Number(merged.featuredCount) || 3)),
    socialLinks: (Array.isArray(merged.socialLinks) ? merged.socialLinks : []).filter((item) => item && typeof item.url === "string" && item.url.trim()).slice(0, 8).map((item) => ({
      label: String(item.label ?? "").slice(0, 40),
      url: String(item.url).slice(0, 500),
      icon: String(item.icon ?? "link").slice(0, 40)
    })),
    theme: {
      ...theme,
      // 预设 ID 必须是已知值，否则回退默认
      preset: THEME_PRESETS.some((p) => p.id === theme.preset) ? theme.preset : DEFAULT_SETTINGS.theme.preset,
      primary: color(theme.primary, DEFAULT_SETTINGS.theme.primary),
      primaryForeground: color(theme.primaryForeground, DEFAULT_SETTINGS.theme.primaryForeground),
      accent: color(theme.accent, DEFAULT_SETTINGS.theme.accent),
      background: color(theme.background, DEFAULT_SETTINGS.theme.background),
      surface: color(theme.surface, DEFAULT_SETTINGS.theme.surface),
      foreground: color(theme.foreground, DEFAULT_SETTINGS.theme.foreground),
      muted: color(theme.muted, DEFAULT_SETTINGS.theme.muted),
      border: color(theme.border, DEFAULT_SETTINGS.theme.border),
      radius: ["none", "small", "medium", "large"].includes(theme.radius) ? theme.radius : DEFAULT_SETTINGS.theme.radius,
      fontFamily: ["system", "sans", "serif", "mono"].includes(theme.fontFamily) ? theme.fontFamily : DEFAULT_SETTINGS.theme.fontFamily,
      containerWidth: ["narrow", "normal", "wide"].includes(theme.containerWidth) ? theme.containerWidth : DEFAULT_SETTINGS.theme.containerWidth,
      colorMode: ["light", "dark", "auto"].includes(theme.colorMode) ? theme.colorMode : DEFAULT_SETTINGS.theme.colorMode
    }
  };
}
async function getSettings() {
  const db = getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
  if (rows.length === 0) return DEFAULT_SETTINGS;
  return sanitize(deepMerge(DEFAULT_SETTINGS, rows[0].value));
}
async function updateSettings(patch) {
  const current = await getSettings();
  const next = sanitize(deepMerge(current, patch));
  const db = getDb();
  await db.insert(settings).values({ key: SETTINGS_KEY, value: next }).onConflictDoUpdate({
    target: settings.key,
    set: { value: next, updatedAt: /* @__PURE__ */ new Date() }
  });
  return next;
}

// apps/api/src/lib/utils.ts
init_dist();
function ok(c, data, status = 200) {
  return c.json({ data }, status);
}
function fail(c, status, error, message, details) {
  return c.json({ error, message, details }, status);
}
function parseIntParam(raw, fallback, min, max) {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function parseBoolParam(raw) {
  if (raw === void 0 || raw === "") return void 0;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return void 0;
}
function makeSlug(title, explicit) {
  const base = slugify(explicit?.trim() || title);
  if (base) return base;
  return `item-${Date.now().toString(36)}`;
}
async function uniqueSlug(desired, exists) {
  if (!await exists(desired)) return desired;
  for (let i = 2; i < 200; i++) {
    const candidate = `${desired}-${i}`;
    if (!await exists(candidate)) return candidate;
  }
  return `${desired}-${Date.now().toString(36)}`;
}
function parseDate(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
async function readJson(c) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
function isSecureRequest(c) {
  const url = new URL(c.req.url);
  if (url.protocol === "https:") return true;
  const proto = c.req.header("x-forwarded-proto");
  return proto === "https";
}

// apps/api/src/lib/auth.ts
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
var COOKIE_NAME = "school_session";
var TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
var DEFAULT_ADMIN_USERNAME = "admin";
var DEFAULT_ADMIN_PASSWORD = "admin123";
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function verifyPassword(plain, hash) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET \u672A\u914D\u7F6E\u6216\u8FC7\u77ED\uFF08\u81F3\u5C11 16 \u5B57\u7B26\uFF09\u3002\u8BF7\u8BBE\u7F6E\u4E00\u4E2A\u968F\u673A\u5B57\u7B26\u4E32\uFF0C\u4F8B\u5982 `openssl rand -base64 32` \u7684\u8F93\u51FA\u3002"
    );
  }
  return new TextEncoder().encode(secret);
}
async function signSession(payload) {
  return new SignJWT({ username: payload.username, mcp: payload.mcp }).setProtectedHeader({ alg: "HS256" }).setSubject(payload.sub).setIssuedAt().setExpirationTime(`${TOKEN_TTL_SECONDS}s`).sign(getSecret());
}
async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      username: String(payload.username ?? ""),
      mcp: Boolean(payload.mcp)
    };
  } catch {
    return null;
  }
}
function readSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}
function buildSessionCookie(token, secure) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TOKEN_TTL_SECONDS}`
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
function buildClearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// apps/api/src/middleware/auth.ts
async function requireAuth(c, next) {
  const token = readSessionCookie(c.req.header("cookie"));
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return fail(c, 401, "unauthorized", "\u767B\u5F55\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
  }
  c.set("session", session);
  await next();
}

// apps/api/src/routes/admin.ts
var adminRoutes = new Hono();
adminRoutes.use("*", requireAuth);
function badRequest(c, message) {
  return fail(c, 400, "validation_error", message);
}
function normalizeStatus(value, fallback = "draft") {
  return value === "published" || value === "draft" ? value : fallback;
}
function normalizeColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : null;
}
adminRoutes.get("/stats", async (c) => {
  const db = getDb();
  const [articleAgg, announcementAgg, categoryAgg, pageAgg, messageAgg, recent] = await Promise.all([
    db.select({
      total: count(),
      published: sql`count(*) filter (where ${articles.status} = 'published')`,
      draft: sql`count(*) filter (where ${articles.status} = 'draft')`,
      views: sql`coalesce(sum(${articles.views}), 0)`
    }).from(articles),
    db.select({
      total: count(),
      published: sql`count(*) filter (where ${announcements.status} = 'published')`,
      draft: sql`count(*) filter (where ${announcements.status} = 'draft')`
    }).from(announcements),
    db.select({ total: count() }).from(categories),
    db.select({ total: count() }).from(pages),
    db.select({
      total: count(),
      pending: sql`count(*) filter (where ${messages.handled} = false)`
    }).from(messages),
    db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      views: articles.views,
      featured: articles.featured,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      categoryName: categories.name
    }).from(articles).leftJoin(categories, eq2(articles.categoryId, categories.id)).orderBy(desc(articles.createdAt)).limit(5)
  ]);
  const a = articleAgg[0];
  const n = announcementAgg[0];
  const m = messageAgg[0];
  return ok(c, {
    articles: {
      total: Number(a?.total ?? 0),
      published: Number(a?.published ?? 0),
      draft: Number(a?.draft ?? 0),
      views: Number(a?.views ?? 0)
    },
    announcements: {
      total: Number(n?.total ?? 0),
      published: Number(n?.published ?? 0),
      draft: Number(n?.draft ?? 0)
    },
    categories: Number(categoryAgg[0]?.total ?? 0),
    pages: Number(pageAgg[0]?.total ?? 0),
    messages: {
      total: Number(m?.total ?? 0),
      pending: Number(m?.pending ?? 0)
    },
    recentArticles: recent.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      views: row.views,
      featured: row.featured,
      publishedAt: iso(row.publishedAt),
      createdAt: iso(row.createdAt),
      categoryName: row.categoryName ?? null
    }))
  });
});
adminRoutes.get("/articles", async (c) => {
  const db = getDb();
  const q = c.req.query();
  const page = parseIntParam(q.page, 1, 1, 1e4);
  const pageSize = parseIntParam(q.pageSize, 20, 1, 100);
  const offset = (page - 1) * pageSize;
  const filters = [];
  if (q.status === "draft" || q.status === "published") {
    filters.push(eq2(articles.status, q.status));
  }
  if (q.category) {
    const parsed = Number.parseInt(q.category, 10);
    if (!Number.isNaN(parsed)) filters.push(eq2(articles.categoryId, parsed));
  }
  if (q.search) {
    const term = `%${q.search.trim()}%`;
    const clause = or(ilike(articles.title, term), ilike(articles.excerpt, term));
    if (clause) filters.push(clause);
  }
  const where = filters.length > 0 ? and(...filters) : void 0;
  const [rows, totalRows] = await Promise.all([
    db.select({ article: articles, category: categories }).from(articles).leftJoin(categories, eq2(articles.categoryId, categories.id)).where(where).orderBy(desc(articles.updatedAt), desc(articles.id)).limit(pageSize).offset(offset),
    db.select({ value: count() }).from(articles).where(where)
  ]);
  const total = Number(totalRows[0]?.value ?? 0);
  return ok(c, {
    items: rows.map(({ article, category }) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      // 列表不返回完整正文，减小响应体积
      excerpt: article.excerpt,
      coverImage: article.coverImage,
      categoryId: article.categoryId,
      status: article.status,
      featured: article.featured,
      views: article.views,
      author: article.author,
      publishedAt: iso(article.publishedAt),
      createdAt: iso(article.createdAt),
      updatedAt: iso(article.updatedAt),
      category: category ? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        color: category.color,
        sortOrder: category.sortOrder,
        createdAt: iso(category.createdAt),
        updatedAt: iso(category.updatedAt)
      } : null
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});
adminRoutes.get("/articles/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u6587\u7AE0 ID");
  const rows = await db.select({ article: articles, category: categories }).from(articles).leftJoin(categories, eq2(articles.categoryId, categories.id)).where(eq2(articles.id, id)).limit(1);
  if (rows.length === 0) return fail(c, 404, "not_found", "\u6587\u7AE0\u4E0D\u5B58\u5728");
  const { article, category } = rows[0];
  return ok(c, {
    ...article,
    publishedAt: iso(article.publishedAt),
    createdAt: iso(article.createdAt),
    updatedAt: iso(article.updatedAt),
    category: category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      color: category.color,
      sortOrder: category.sortOrder,
      createdAt: iso(category.createdAt),
      updatedAt: iso(category.updatedAt)
    } : null
  });
});
adminRoutes.post("/articles", async (c) => {
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "");
  if (!title) return badRequest(c, "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  if (title.length > 255) return badRequest(c, "\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7 255 \u5B57");
  const status = normalizeStatus(body.status, "draft");
  const db = getDb();
  const slug = await uniqueSlug(makeSlug(title, body.slug), async (candidate) => {
    const hit = await db.select({ id: articles.id }).from(articles).where(eq2(articles.slug, candidate)).limit(1);
    return hit.length > 0;
  });
  let categoryId = null;
  if (body.categoryId !== null && body.categoryId !== void 0 && body.categoryId !== "") {
    const parsed = Number(body.categoryId);
    if (!Number.isNaN(parsed)) {
      const hit = await db.select({ id: categories.id }).from(categories).where(eq2(categories.id, parsed)).limit(1);
      categoryId = hit.length > 0 ? parsed : null;
    }
  }
  const publishedAt = parseDate(body.publishedAt) ?? (status === "published" ? /* @__PURE__ */ new Date() : null);
  const excerpt = typeof body.excerpt === "string" && body.excerpt.trim() ? body.excerpt.trim() : deriveExcerpt(content);
  const inserted = await db.insert(articles).values({
    title,
    slug,
    content,
    excerpt,
    coverImage: typeof body.coverImage === "string" && body.coverImage.trim() ? body.coverImage.trim() : null,
    categoryId,
    status,
    featured: Boolean(body.featured),
    author: typeof body.author === "string" && body.author.trim() ? body.author.trim() : null,
    publishedAt
  }).returning({ id: articles.id, slug: articles.slug });
  return ok(c, inserted[0], 201);
});
adminRoutes.put("/articles/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u6587\u7AE0 ID");
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const existing = await db.select().from(articles).where(eq2(articles.id, id)).limit(1);
  if (existing.length === 0) return fail(c, 404, "not_found", "\u6587\u7AE0\u4E0D\u5B58\u5728");
  const current = existing[0];
  const patch = { updatedAt: /* @__PURE__ */ new Date() };
  if (body.title !== void 0) {
    const title = String(body.title).trim();
    if (!title) return badRequest(c, "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    if (title.length > 255) return badRequest(c, "\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7 255 \u5B57");
    patch.title = title;
  }
  if (body.slug !== void 0) {
    const raw = String(body.slug).trim();
    const desired = makeSlug(String(patch.title ?? current.title), raw);
    if (desired !== current.slug) {
      patch.slug = await uniqueSlug(desired, async (candidate) => {
        const hit = await db.select({ id: articles.id }).from(articles).where(and(eq2(articles.slug, candidate), sql`${articles.id} <> ${id}`)).limit(1);
        return hit.length > 0;
      });
    }
  }
  if (body.content !== void 0) {
    const content = String(body.content);
    patch.content = content;
    if (body.excerpt === void 0) patch.excerpt = deriveExcerpt(content);
  }
  if (body.excerpt !== void 0) {
    patch.excerpt = typeof body.excerpt === "string" && body.excerpt.trim() ? body.excerpt.trim() : null;
  }
  if (body.coverImage !== void 0) {
    patch.coverImage = typeof body.coverImage === "string" && body.coverImage.trim() ? body.coverImage.trim() : null;
  }
  if (body.author !== void 0) {
    patch.author = typeof body.author === "string" && body.author.trim() ? body.author.trim() : null;
  }
  if (body.featured !== void 0) patch.featured = Boolean(body.featured);
  if (body.categoryId !== void 0) {
    if (body.categoryId === null || body.categoryId === "") {
      patch.categoryId = null;
    } else {
      const parsed = Number(body.categoryId);
      const hit = Number.isNaN(parsed) ? [] : await db.select({ id: categories.id }).from(categories).where(eq2(categories.id, parsed)).limit(1);
      patch.categoryId = hit.length > 0 ? parsed : null;
    }
  }
  if (body.status !== void 0) {
    const status = normalizeStatus(body.status, current.status);
    patch.status = status;
    if (status === "published" && !current.publishedAt) {
      patch.publishedAt = parseDate(body.publishedAt) ?? /* @__PURE__ */ new Date();
    }
  }
  if (body.publishedAt !== void 0) {
    patch.publishedAt = parseDate(body.publishedAt);
  }
  await db.update(articles).set(patch).where(eq2(articles.id, id));
  return ok(c, { ok: true });
});
adminRoutes.delete("/articles/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u6587\u7AE0 ID");
  const deleted = await db.delete(articles).where(eq2(articles.id, id)).returning({ id: articles.id });
  if (deleted.length === 0) return fail(c, 404, "not_found", "\u6587\u7AE0\u4E0D\u5B58\u5728");
  return ok(c, { ok: true });
});
adminRoutes.post("/articles/batch-delete", async (c) => {
  const body = await readJson(c);
  const raw = Array.isArray(body?.ids) ? body.ids : [];
  const ids = raw.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return badRequest(c, "\u8BF7\u63D0\u4F9B\u8981\u5220\u9664\u7684\u6587\u7AE0 ID");
  if (ids.length > 200) return badRequest(c, "\u5355\u6B21\u6700\u591A\u5220\u9664 200 \u7BC7");
  const db = getDb();
  const deleted = await db.delete(articles).where(sql`${articles.id} in ${ids}`).returning({ id: articles.id });
  return ok(c, { ok: true, deleted: deleted.length });
});
adminRoutes.get("/categories", async (c) => {
  const db = getDb();
  const rows = await db.select({ category: categories, articleCount: count(articles.id) }).from(categories).leftJoin(articles, eq2(articles.categoryId, categories.id)).groupBy(categories.id).orderBy(asc(categories.sortOrder), asc(categories.id));
  return ok(
    c,
    rows.map(({ category, articleCount }) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      color: category.color,
      sortOrder: category.sortOrder,
      createdAt: iso(category.createdAt),
      updatedAt: iso(category.updatedAt),
      articleCount: Number(articleCount)
    }))
  );
});
adminRoutes.post("/categories", async (c) => {
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest(c, "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
  if (name.length > 100) return badRequest(c, "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC7 100 \u5B57");
  const db = getDb();
  const slug = await uniqueSlug(makeSlug(name, body.slug), async (candidate) => {
    const hit = await db.select({ id: categories.id }).from(categories).where(eq2(categories.slug, candidate)).limit(1);
    return hit.length > 0;
  });
  const inserted = await db.insert(categories).values({
    name,
    slug,
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    color: normalizeColor(body.color),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
  }).returning({ id: categories.id, slug: categories.slug });
  return ok(c, inserted[0], 201);
});
adminRoutes.put("/categories/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u5206\u7C7B ID");
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const existing = await db.select().from(categories).where(eq2(categories.id, id)).limit(1);
  if (existing.length === 0) return fail(c, 404, "not_found", "\u5206\u7C7B\u4E0D\u5B58\u5728");
  const current = existing[0];
  const patch = { updatedAt: /* @__PURE__ */ new Date() };
  if (body.name !== void 0) {
    const name = String(body.name).trim();
    if (!name) return badRequest(c, "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
    patch.name = name.slice(0, 100);
  }
  if (body.slug !== void 0) {
    const desired = makeSlug(String(patch.name ?? current.name), String(body.slug));
    if (desired !== current.slug) {
      patch.slug = await uniqueSlug(desired, async (candidate) => {
        const hit = await db.select({ id: categories.id }).from(categories).where(and(eq2(categories.slug, candidate), sql`${categories.id} <> ${id}`)).limit(1);
        return hit.length > 0;
      });
    }
  }
  if (body.description !== void 0) {
    patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if (body.color !== void 0) patch.color = normalizeColor(body.color);
  if (body.sortOrder !== void 0 && Number.isFinite(Number(body.sortOrder))) {
    patch.sortOrder = Number(body.sortOrder);
  }
  await db.update(categories).set(patch).where(eq2(categories.id, id));
  return ok(c, { ok: true });
});
adminRoutes.delete("/categories/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u5206\u7C7B ID");
  const deleted = await db.delete(categories).where(eq2(categories.id, id)).returning({ id: categories.id });
  if (deleted.length === 0) return fail(c, 404, "not_found", "\u5206\u7C7B\u4E0D\u5B58\u5728");
  return ok(c, { ok: true });
});
adminRoutes.get("/announcements", async (c) => {
  const db = getDb();
  const rows = await db.select().from(announcements).orderBy(desc(announcements.pinned), desc(announcements.createdAt));
  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      level: row.level,
      status: row.status,
      pinned: row.pinned,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    }))
  );
});
adminRoutes.post("/announcements", async (c) => {
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const title = String(body.title ?? "").trim();
  if (!title) return badRequest(c, "\u516C\u544A\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  if (title.length > 255) return badRequest(c, "\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7 255 \u5B57");
  const level = ["info", "important", "urgent"].includes(String(body.level)) ? String(body.level) : "info";
  const db = getDb();
  const inserted = await db.insert(announcements).values({
    title,
    content: String(body.content ?? ""),
    level,
    status: normalizeStatus(body.status, "draft"),
    pinned: Boolean(body.pinned),
    startsAt: parseDate(body.startsAt),
    endsAt: parseDate(body.endsAt)
  }).returning({ id: announcements.id });
  return ok(c, inserted[0], 201);
});
adminRoutes.put("/announcements/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u516C\u544A ID");
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const existing = await db.select().from(announcements).where(eq2(announcements.id, id)).limit(1);
  if (existing.length === 0) return fail(c, 404, "not_found", "\u516C\u544A\u4E0D\u5B58\u5728");
  const patch = { updatedAt: /* @__PURE__ */ new Date() };
  if (body.title !== void 0) {
    const title = String(body.title).trim();
    if (!title) return badRequest(c, "\u516C\u544A\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    patch.title = title.slice(0, 255);
  }
  if (body.content !== void 0) patch.content = String(body.content);
  if (body.status !== void 0) patch.status = normalizeStatus(body.status);
  if (body.pinned !== void 0) patch.pinned = Boolean(body.pinned);
  if (body.level !== void 0 && ["info", "important", "urgent"].includes(String(body.level))) {
    patch.level = String(body.level);
  }
  if (body.startsAt !== void 0) patch.startsAt = parseDate(body.startsAt);
  if (body.endsAt !== void 0) patch.endsAt = parseDate(body.endsAt);
  await db.update(announcements).set(patch).where(eq2(announcements.id, id));
  return ok(c, { ok: true });
});
adminRoutes.delete("/announcements/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u516C\u544A ID");
  const deleted = await db.delete(announcements).where(eq2(announcements.id, id)).returning({ id: announcements.id });
  if (deleted.length === 0) return fail(c, 404, "not_found", "\u516C\u544A\u4E0D\u5B58\u5728");
  return ok(c, { ok: true });
});
adminRoutes.get("/pages", async (c) => {
  const db = getDb();
  const rows = await db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.id));
  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      content: row.content,
      status: row.status,
      showInNav: row.showInNav,
      sortOrder: row.sortOrder,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    }))
  );
});
adminRoutes.post("/pages", async (c) => {
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const title = String(body.title ?? "").trim();
  if (!title) return badRequest(c, "\u9875\u9762\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  const db = getDb();
  const slug = await uniqueSlug(makeSlug(title, body.slug), async (candidate) => {
    const hit = await db.select({ id: pages.id }).from(pages).where(eq2(pages.slug, candidate)).limit(1);
    return hit.length > 0;
  });
  const inserted = await db.insert(pages).values({
    title: title.slice(0, 255),
    slug,
    summary: body.summary === void 0 || body.summary === null ? null : String(body.summary),
    content: String(body.content ?? ""),
    status: normalizeStatus(body.status, "published"),
    showInNav: body.showInNav === void 0 ? true : Boolean(body.showInNav),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
  }).returning({ id: pages.id, slug: pages.slug });
  return ok(c, inserted[0], 201);
});
adminRoutes.put("/pages/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u9875\u9762 ID");
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const existing = await db.select().from(pages).where(eq2(pages.id, id)).limit(1);
  if (existing.length === 0) return fail(c, 404, "not_found", "\u9875\u9762\u4E0D\u5B58\u5728");
  const current = existing[0];
  const patch = { updatedAt: /* @__PURE__ */ new Date() };
  if (body.title !== void 0) {
    const title = String(body.title).trim();
    if (!title) return badRequest(c, "\u9875\u9762\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    patch.title = title.slice(0, 255);
  }
  if (body.slug !== void 0) {
    const desired = makeSlug(String(patch.title ?? current.title), String(body.slug));
    if (desired !== current.slug) {
      patch.slug = await uniqueSlug(desired, async (candidate) => {
        const hit = await db.select({ id: pages.id }).from(pages).where(and(eq2(pages.slug, candidate), sql`${pages.id} <> ${id}`)).limit(1);
        return hit.length > 0;
      });
    }
  }
  if (body.summary !== void 0) {
    patch.summary = body.summary === null ? null : String(body.summary);
  }
  if (body.content !== void 0) patch.content = String(body.content);
  if (body.status !== void 0) patch.status = normalizeStatus(body.status, "published");
  if (body.showInNav !== void 0) patch.showInNav = Boolean(body.showInNav);
  if (body.sortOrder !== void 0 && Number.isFinite(Number(body.sortOrder))) {
    patch.sortOrder = Number(body.sortOrder);
  }
  await db.update(pages).set(patch).where(eq2(pages.id, id));
  return ok(c, { ok: true });
});
adminRoutes.delete("/pages/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u9875\u9762 ID");
  const deleted = await db.delete(pages).where(eq2(pages.id, id)).returning({ id: pages.id });
  if (deleted.length === 0) return fail(c, 404, "not_found", "\u9875\u9762\u4E0D\u5B58\u5728");
  return ok(c, { ok: true });
});
adminRoutes.get("/settings", async (c) => {
  return ok(c, await getSettings());
});
adminRoutes.put("/settings", async (c) => {
  const body = await readJson(c);
  if (!body) return badRequest(c, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const next = await updateSettings(body);
  return ok(c, next);
});
adminRoutes.post("/settings/theme/reset", async (c) => {
  const body = await readJson(c);
  const presetId = body?.preset ?? "academic-blue";
  const { THEME_PRESETS: THEME_PRESETS2 } = await Promise.resolve().then(() => (init_dist(), dist_exports));
  const preset = THEME_PRESETS2.find((p) => p.id === presetId);
  if (!preset) return badRequest(c, "\u672A\u77E5\u7684\u4E3B\u9898\u9884\u8BBE");
  const next = await updateSettings({ theme: { preset: preset.id, ...preset.colors } });
  return ok(c, next);
});
adminRoutes.get("/media", async (c) => {
  const db = getDb();
  const limit = parseIntParam(c.req.query("limit"), 60, 1, 200);
  const rows = await db.select().from(media).orderBy(desc(media.createdAt)).limit(limit);
  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      url: row.url,
      mimeType: row.mimeType,
      bytes: row.bytes,
      createdAt: iso(row.createdAt)
    }))
  );
});
adminRoutes.delete("/media/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u5A92\u4F53 ID");
  const deleted = await db.delete(media).where(eq2(media.id, id)).returning({ id: media.id });
  if (deleted.length === 0) return fail(c, 404, "not_found", "\u5A92\u4F53\u4E0D\u5B58\u5728");
  return ok(c, { ok: true });
});
adminRoutes.get("/messages", async (c) => {
  const db = getDb();
  const page = parseIntParam(c.req.query("page"), 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parseIntParam(c.req.query("pageSize"), 20, 1, 100);
  const handledParam = c.req.query("handled");
  const search = c.req.query("search")?.trim();
  const filters = [];
  if (handledParam === "true" || handledParam === "false") {
    filters.push(eq2(messages.handled, handledParam === "true"));
  }
  if (search) {
    filters.push(
      or(
        ilike(messages.name, `%${search}%`),
        ilike(messages.content, `%${search}%`),
        ilike(messages.subject, `%${search}%`)
      )
    );
  }
  const where = filters.length > 0 ? and(...filters) : void 0;
  const [rows, totalAgg] = await Promise.all([
    db.select().from(messages).where(where).orderBy(desc(messages.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(messages).where(where)
  ]);
  const total = Number(totalAgg[0]?.total ?? 0);
  return ok(c, {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      content: row.content,
      isHandled: row.handled,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
});
adminRoutes.put("/messages/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u7559\u8A00 ID");
  const body = await readJson(c);
  await db.update(messages).set({ handled: Boolean(body?.isHandled), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(messages.id, id));
  return ok(c, { ok: true });
});
adminRoutes.delete("/messages/:id", async (c) => {
  const db = getDb();
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) return badRequest(c, "\u65E0\u6548\u7684\u7559\u8A00 ID");
  const deleted = await db.delete(messages).where(eq2(messages.id, id)).returning({ id: messages.id });
  if (deleted.length === 0) return fail(c, 404, "not_found", "\u7559\u8A00\u4E0D\u5B58\u5728");
  return ok(c, { ok: true });
});

// apps/api/src/routes/auth.ts
import { Hono as Hono2 } from "hono";
import { eq as eq3 } from "drizzle-orm";
var authRoutes = new Hono2();
async function ensureAdmin() {
  const db = getDb();
  const existing = await db.select({ id: admins.id }).from(admins).limit(1);
  if (existing.length > 0) return;
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await db.insert(admins).values({
    username: DEFAULT_ADMIN_USERNAME,
    passwordHash,
    displayName: "\u7BA1\u7406\u5458",
    mustChangePassword: true
  }).onConflictDoNothing();
}
authRoutes.post("/login", async (c) => {
  const body = await readJson(c);
  const password = body?.password ?? "";
  const username = (body?.username ?? DEFAULT_ADMIN_USERNAME).trim();
  if (!password) {
    return fail(c, 400, "invalid_body", "\u8BF7\u8F93\u5165\u7BA1\u7406\u5458\u5BC6\u7801");
  }
  await ensureAdmin();
  const db = getDb();
  const rows = await db.select().from(admins).where(eq3(admins.username, username)).limit(1);
  const admin = rows[0];
  const validHash = admin?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const valid = await verifyPassword(password, validHash);
  if (!admin || !valid) {
    return fail(c, 401, "invalid_credentials", "\u5BC6\u7801\u9519\u8BEF");
  }
  await db.update(admins).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where(eq3(admins.id, admin.id));
  const token = await signSession({
    sub: String(admin.id),
    username: admin.username,
    mcp: admin.mustChangePassword
  });
  c.header("Set-Cookie", buildSessionCookie(token, isSecureRequest(c)));
  return ok(c, { ok: true, mustChangePassword: admin.mustChangePassword });
});
authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", buildClearCookie());
  return ok(c, { ok: true });
});
authRoutes.get("/session", async (c) => {
  const token = readSessionCookie(c.req.header("cookie"));
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return ok(c, { authenticated: false, mustChangePassword: false });
  }
  return ok(c, {
    authenticated: true,
    mustChangePassword: session.mcp,
    username: session.username
  });
});
authRoutes.post("/change-password", requireAuth, async (c) => {
  const body = await readJson(c);
  const currentPassword = body?.currentPassword ?? "";
  const newPassword = body?.newPassword ?? "";
  if (newPassword.length < 8) {
    return fail(c, 400, "weak_password", "\u65B0\u5BC6\u7801\u81F3\u5C11\u9700\u8981 8 \u4F4D");
  }
  if (newPassword === DEFAULT_ADMIN_PASSWORD) {
    return fail(c, 400, "weak_password", "\u4E0D\u80FD\u7EE7\u7EED\u4F7F\u7528\u521D\u59CB\u5BC6\u7801\uFF0C\u8BF7\u66F4\u6362");
  }
  const db = getDb();
  const session = c.get("session");
  const rows = await db.select().from(admins).where(eq3(admins.id, Number(session.sub))).limit(1);
  const admin = rows[0];
  if (!admin) {
    return fail(c, 401, "unauthorized", "\u8D26\u53F7\u4E0D\u5B58\u5728");
  }
  const valid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!valid) {
    return fail(c, 400, "invalid_credentials", "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.update(admins).set({ passwordHash, mustChangePassword: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(admins.id, admin.id));
  const token = await signSession({
    sub: String(admin.id),
    username: admin.username,
    mcp: false
  });
  c.header("Set-Cookie", buildSessionCookie(token, isSecureRequest(c)));
  return ok(c, { ok: true });
});

// apps/api/src/routes/public.ts
import { Hono as Hono3 } from "hono";
import { and as and2, asc as asc2, count as count2, desc as desc2, eq as eq4, gte, ilike as ilike2, isNull, lte, or as or2, sql as sql2 } from "drizzle-orm";
var publicRoutes = new Hono3();
function serializeCategory(row, articleCount) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    ...articleCount === void 0 ? {} : { articleCount }
  };
}
function serializeArticle(row, category) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt,
    coverImage: row.coverImage,
    categoryId: row.categoryId,
    status: row.status,
    featured: row.featured,
    views: row.views,
    author: row.author,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    category: category ? serializeCategory(category) : null
  };
}
publicRoutes.get("/settings", async (c) => {
  return ok(c, await getSettings());
});
publicRoutes.get("/navigation", async (c) => {
  const db = getDb();
  const [cats, navPages, config2] = await Promise.all([
    db.select().from(categories).orderBy(asc2(categories.sortOrder), asc2(categories.id)),
    db.select().from(pages).where(and2(eq4(pages.status, "published"), eq4(pages.showInNav, true))).orderBy(asc2(pages.sortOrder), asc2(pages.id)),
    getSettings()
  ]);
  return ok(c, {
    categories: config2.showCategories ? cats.map((row) => serializeCategory(row)) : [],
    pages: navPages.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      sortOrder: row.sortOrder
    })),
    siteName: config2.siteName
  });
});
publicRoutes.get("/categories", async (c) => {
  const db = getDb();
  const rows = await db.select({
    category: categories,
    articleCount: count2(articles.id)
  }).from(categories).leftJoin(
    articles,
    and2(eq4(articles.categoryId, categories.id), eq4(articles.status, "published"))
  ).groupBy(categories.id).orderBy(asc2(categories.sortOrder), asc2(categories.id));
  return ok(c, rows.map(({ category, articleCount }) => serializeCategory(category, Number(articleCount))));
});
publicRoutes.get("/articles", async (c) => {
  const db = getDb();
  const q = c.req.query();
  const page = parseIntParam(q.page, 1, 1, 1e4);
  const pageSize = parseIntParam(q.pageSize, 9, 1, 50);
  const offset = (page - 1) * pageSize;
  const featured = parseBoolParam(q.featured);
  const sort = q.sort ?? "latest";
  const filters = [eq4(articles.status, "published")];
  if (q.category) {
    const cat = await db.select({ id: categories.id }).from(categories).where(eq4(categories.slug, q.category)).limit(1);
    if (cat.length === 0) {
      return ok(c, { items: [], total: 0, page, pageSize, totalPages: 0 });
    }
    filters.push(eq4(articles.categoryId, cat[0].id));
  }
  if (q.search) {
    const term = `%${q.search.trim()}%`;
    const searchClause = or2(ilike2(articles.title, term), ilike2(articles.excerpt, term));
    if (searchClause) filters.push(searchClause);
  }
  if (featured !== void 0) filters.push(eq4(articles.featured, featured));
  const where = and2(...filters);
  const orderBy = (() => {
    switch (sort) {
      case "oldest":
        return [asc2(articles.publishedAt), asc2(articles.id)];
      case "popular":
        return [desc2(articles.views), desc2(articles.id)];
      case "title":
        return [asc2(articles.title)];
      default:
        return [desc2(articles.publishedAt), desc2(articles.id)];
    }
  })();
  const finalOrder = sort === "title" ? orderBy : [desc2(articles.featured), ...orderBy];
  const [rows, totalRows] = await Promise.all([
    db.select({ article: articles, category: categories }).from(articles).leftJoin(categories, eq4(articles.categoryId, categories.id)).where(where).orderBy(...finalOrder).limit(pageSize).offset(offset),
    db.select({ value: count2() }).from(articles).where(where)
  ]);
  const total = Number(totalRows[0]?.value ?? 0);
  return ok(c, {
    items: rows.map(({ article, category }) => serializeArticle(article, category)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});
publicRoutes.get("/articles/:slug", async (c) => {
  const db = getDb();
  const slug = c.req.param("slug");
  const rows = await db.select({ article: articles, category: categories }).from(articles).leftJoin(categories, eq4(articles.categoryId, categories.id)).where(and2(eq4(articles.slug, slug), eq4(articles.status, "published"))).limit(1);
  if (rows.length === 0) {
    return fail(c, 404, "not_found", "\u6587\u7AE0\u4E0D\u5B58\u5728\u6216\u5C1A\u672A\u53D1\u5E03");
  }
  const { article, category } = rows[0];
  try {
    await db.update(articles).set({ views: sql2`${articles.views} + 1` }).where(eq4(articles.id, article.id));
  } catch {
  }
  const related = article.categoryId ? await db.select({
    id: articles.id,
    title: articles.title,
    slug: articles.slug,
    publishedAt: articles.publishedAt
  }).from(articles).where(
    and2(
      eq4(articles.status, "published"),
      eq4(articles.categoryId, article.categoryId),
      sql2`${articles.id} <> ${article.id}`
    )
  ).orderBy(desc2(articles.publishedAt)).limit(5) : [];
  return ok(c, {
    ...serializeArticle({ ...article, views: article.views + 1 }, category),
    related: related.map((r) => ({ ...r, publishedAt: iso(r.publishedAt) }))
  });
});
publicRoutes.get("/announcements", async (c) => {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const limit = parseIntParam(c.req.query("limit"), 20, 1, 100);
  const where = and2(
    eq4(announcements.status, "published"),
    // 未到开始时间或已过结束时间的公告不展示
    or2(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
    or2(isNull(announcements.endsAt), gte(announcements.endsAt, now))
  );
  const rows = await db.select().from(announcements).where(where).orderBy(desc2(announcements.pinned), desc2(announcements.createdAt)).limit(limit);
  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      level: row.level,
      status: row.status,
      pinned: row.pinned,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    }))
  );
});
publicRoutes.get("/pages/:slug", async (c) => {
  const db = getDb();
  const rows = await db.select().from(pages).where(and2(eq4(pages.slug, c.req.param("slug")), eq4(pages.status, "published"))).limit(1);
  if (rows.length === 0) {
    return fail(c, 404, "not_found", "\u9875\u9762\u4E0D\u5B58\u5728");
  }
  const row = rows[0];
  return ok(c, {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    status: row.status,
    showInNav: row.showInNav,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  });
});
publicRoutes.get("/home", async (c) => {
  const db = getDb();
  const config2 = await getSettings();
  const now = /* @__PURE__ */ new Date();
  const [featured, latest, announcementRows, cats] = await Promise.all([
    config2.showFeaturedArticles ? db.select({ article: articles, category: categories }).from(articles).leftJoin(categories, eq4(articles.categoryId, categories.id)).where(and2(eq4(articles.status, "published"), eq4(articles.featured, true))).orderBy(desc2(articles.publishedAt)).limit(config2.featuredCount) : Promise.resolve([]),
    db.select({ article: articles, category: categories }).from(articles).leftJoin(categories, eq4(articles.categoryId, categories.id)).where(eq4(articles.status, "published")).orderBy(desc2(articles.publishedAt), desc2(articles.id)).limit(8),
    db.select().from(announcements).where(
      and2(
        eq4(announcements.status, "published"),
        or2(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
        or2(isNull(announcements.endsAt), gte(announcements.endsAt, now))
      )
    ).orderBy(desc2(announcements.pinned), desc2(announcements.createdAt)).limit(6),
    config2.showCategories ? db.select({ category: categories, articleCount: count2(articles.id) }).from(categories).leftJoin(
      articles,
      and2(eq4(articles.categoryId, categories.id), eq4(articles.status, "published"))
    ).groupBy(categories.id).orderBy(asc2(categories.sortOrder), asc2(categories.id)) : Promise.resolve([])
  ]);
  return ok(c, {
    settings: config2,
    featured: featured.map(({ article, category }) => serializeArticle(article, category)),
    latest: latest.map(({ article, category }) => serializeArticle(article, category)),
    announcements: announcementRows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      level: row.level,
      status: row.status,
      pinned: row.pinned,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    })),
    categories: cats.map(
      ({ category, articleCount }) => serializeCategory(category, Number(articleCount))
    )
  });
});
publicRoutes.post("/messages", async (c) => {
  const body = await readJson(c);
  if (!body) return fail(c, 400, "invalid_body", "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E");
  const name = String(body.name ?? "").trim();
  const content = String(body.content ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const subject = body.subject ? String(body.subject).trim() : null;
  if (!name || name.length > 100) {
    return fail(c, 400, "invalid_name", "\u8BF7\u586B\u5199\u59D3\u540D\uFF08\u4E0D\u8D85\u8FC7 100 \u5B57\uFF09");
  }
  if (!content || content.length > 5e3) {
    return fail(c, 400, "invalid_content", "\u8BF7\u586B\u5199\u7559\u8A00\u5185\u5BB9\uFF08\u4E0D\u8D85\u8FC7 5000 \u5B57\uFF09");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(c, 400, "invalid_email", "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E");
  }
  const db = getDb();
  await db.insert(messages).values({ name, content, email, phone, subject });
  return ok(c, { ok: true }, 201);
});

// apps/api/src/routes/upload.ts
import { Hono as Hono4 } from "hono";
import { desc as desc3, eq as eq5 } from "drizzle-orm";

// apps/api/src/lib/s3.ts
var encoder = new TextEncoder();
function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(data) {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return toHex(await crypto.subtle.digest("SHA-256", copy));
}
async function hmac(key, data) {
  const keyCopy = new Uint8Array(key.length);
  keyCopy.set(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyCopy,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  const copy = new Uint8Array(signature.byteLength);
  copy.set(new Uint8Array(signature));
  return copy;
}
function encodePath(path) {
  return path.split("/").map(
    (seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
  ).join("/");
}
function makeObjectKey(filename) {
  const now = /* @__PURE__ */ new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safe = filename.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(-80);
  const rand = Math.random().toString(36).slice(2, 10);
  return `uploads/${yyyy}/${mm}/${Date.now().toString(36)}-${rand}-${safe}`;
}
async function uploadToS3(config2, params) {
  const key = makeObjectKey(params.filename);
  const endpoint = new URL(config2.endpoint);
  const host = endpoint.host;
  const canonicalUri = encodePath(`/${config2.bucket}/${key}`);
  const now = /* @__PURE__ */ new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(params.bytes);
  const headers = {
    host,
    "content-type": params.mimeType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}
`).join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    // 无查询参数
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const scope = `${dateStamp}/${config2.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest)
  ].join("\n");
  let signingKey = encoder.encode(`AWS4${config2.secretAccessKey}`);
  for (const part of [dateStamp, config2.region, "s3", "aws4_request"]) {
    signingKey = await hmac(signingKey, part);
  }
  const signature = toHex((await hmac(signingKey, stringToSign)).buffer);
  const authorization = `AWS4-HMAC-SHA256 Credential=${config2.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`${endpoint.origin}${canonicalUri}`, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: authorization
    },
    body: params.bytes
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`S3 \u8FD4\u56DE ${response.status} ${response.statusText}${detail ? ` \u2014 ${detail.slice(0, 300)}` : ""}`);
  }
  return `${config2.publicBaseUrl.replace(/\/$/, "")}/${key}`;
}

// apps/api/src/routes/upload.ts
var uploadRoutes = new Hono4();
uploadRoutes.use("*", requireAuth);
var MAX_BYTES = 15e5;
var ALLOWED_MIME = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif"
]);
function getStorageDriver() {
  const raw = (process.env.STORAGE_DRIVER ?? "dataurl").toLowerCase();
  return raw === "s3" ? "s3" : "dataurl";
}
function getS3Config() {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_BASE_URL
  } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return null;
  }
  return {
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "auto",
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    publicBaseUrl: S3_PUBLIC_BASE_URL || `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}`
  };
}
uploadRoutes.post("/", async (c) => {
  const driver = getStorageDriver();
  let filename = "image";
  let mimeType = "image/png";
  let bytes;
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await readJson(c);
    if (!body?.data) return fail(c, 400, "invalid_body", "\u7F3A\u5C11\u56FE\u7247\u6570\u636E");
    filename = (body.filename ?? "image").slice(0, 200);
    mimeType = (body.mimeType ?? "image/png").slice(0, 100);
    const base64 = body.data.includes(",") ? body.data.slice(body.data.indexOf(",") + 1) : body.data;
    try {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      return fail(c, 400, "invalid_data", "\u56FE\u7247\u6570\u636E\u4E0D\u662F\u5408\u6CD5\u7684 base64");
    }
  } else {
    const buffer = await c.req.arrayBuffer();
    bytes = new Uint8Array(buffer);
    mimeType = contentType.split(";")[0].trim() || "image/png";
    filename = (c.req.header("x-filename") ?? "image").slice(0, 200);
  }
  if (bytes.byteLength === 0) {
    return fail(c, 400, "empty_file", "\u6587\u4EF6\u4E3A\u7A7A");
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return fail(c, 400, "unsupported_type", `\u4E0D\u652F\u6301\u7684\u56FE\u7247\u683C\u5F0F\uFF1A${mimeType}`);
  }
  const limit = driver === "s3" ? 8e6 : MAX_BYTES;
  if (bytes.byteLength > limit) {
    return fail(
      c,
      413,
      "too_large",
      `\u56FE\u7247\u8FC7\u5927\uFF08${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB\uFF09\uFF0C\u4E0A\u9650 ${(limit / 1024 / 1024).toFixed(1)}MB`
    );
  }
  let url;
  if (driver === "s3") {
    const config2 = getS3Config();
    if (!config2) {
      return fail(
        c,
        500,
        "storage_not_configured",
        "STORAGE_DRIVER=s3 \u4F46\u7F3A\u5C11 S3_* \u73AF\u5883\u53D8\u91CF\u914D\u7F6E"
      );
    }
    try {
      url = await uploadToS3(config2, { filename, mimeType, bytes });
    } catch (error) {
      return fail(c, 502, "upload_failed", `\u4E0A\u4F20\u5230\u5BF9\u8C61\u5B58\u50A8\u5931\u8D25\uFF1A${error.message}`);
    }
  } else {
    const base64 = bytesToBase64(bytes);
    url = `data:${mimeType};base64,${base64}`;
  }
  const db = getDb();
  const inserted = await db.insert(media).values({ filename, url, mimeType, bytes: bytes.byteLength }).returning({ id: media.id });
  return ok(c, { id: inserted[0]?.id, url, bytes: bytes.byteLength, driver }, 201);
});
uploadRoutes.get("/config", (c) => {
  const driver = getStorageDriver();
  const configured = driver === "s3" ? getS3Config() !== null : true;
  return ok(c, {
    driver,
    configured,
    maxBytes: driver === "s3" ? 8e6 : MAX_BYTES,
    allowedMime: [...ALLOWED_MIME]
  });
});
uploadRoutes.get("/lookup", async (c) => {
  const url = c.req.query("url");
  if (!url) return fail(c, 400, "invalid_query", "\u7F3A\u5C11 url \u53C2\u6570");
  const db = getDb();
  const rows = await db.select().from(media).where(eq5(media.url, url)).limit(1);
  if (rows.length === 0) return fail(c, 404, "not_found", "\u672A\u627E\u5230\u5BF9\u5E94\u5A92\u4F53");
  const row = rows[0];
  return ok(c, { id: row.id, filename: row.filename, url: row.url, bytes: row.bytes });
});
uploadRoutes.get("/", async (c) => {
  const db = getDb();
  const rows = await db.select().from(media).orderBy(desc3(media.createdAt)).limit(60);
  return ok(
    c,
    rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      url: row.url,
      mimeType: row.mimeType,
      bytes: row.bytes,
      createdAt: row.createdAt.toISOString()
    }))
  );
});
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// apps/api/src/app.ts
function createApp() {
  const app2 = new Hono5();
  app2.use("*", secureHeaders({ xFrameOptions: false }));
  app2.use("/api/*", async (c, next) => {
    const configured = (c.env?.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? "").trim();
    const origin = c.req.header("origin") ?? "";
    const allowAll = configured === "*" || configured === "";
    const allowed = configured.split(",").map((s) => s.trim()).filter(Boolean);
    const allowOrigin = allowAll ? origin || "*" : allowed.includes(origin) ? origin : allowed[0] ?? "";
    return cors({
      origin: allowOrigin,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Filename"],
      exposeHeaders: ["Content-Length"],
      credentials: true,
      maxAge: 86400
    })(c, next);
  });
  app2.get(
    "/api/health",
    (c) => c.json({
      data: {
        ok: true,
        service: "school-site-api",
        runtime: typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers" ? "cloudflare-workers" : "node",
        time: (/* @__PURE__ */ new Date()).toISOString()
      }
    })
  );
  app2.get(
    "/",
    (c) => c.json({
      data: {
        name: "\u5B66\u6821\u5B98\u7F51 API",
        version: "1.0.0",
        endpoints: {
          public: "/api/public/*",
          auth: "/api/auth/*",
          admin: "/api/admin/*",
          upload: "/api/upload"
        }
      }
    })
  );
  app2.route("/api/public", publicRoutes);
  app2.route("/api/auth", authRoutes);
  app2.route("/api/admin", adminRoutes);
  app2.route("/api/upload", uploadRoutes);
  app2.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return fail(c, 404, "not_found", `\u63A5\u53E3\u4E0D\u5B58\u5728\uFF1A${c.req.method} ${c.req.path}`);
    }
    return c.text("Not Found", 404);
  });
  app2.onError((error, c) => {
    console.error("[api error]", error);
    const message = error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF";
    if (/DATABASE_URL|AUTH_SECRET/.test(message)) {
      return fail(c, 500, "configuration_error", message);
    }
    if (/duplicate key value|unique constraint/i.test(message)) {
      return fail(c, 409, "conflict", "\u5B58\u5728\u91CD\u590D\u6570\u636E\uFF0C\u8BF7\u68C0\u67E5\u540D\u79F0\u6216\u6807\u8BC6\u662F\u5426\u5DF2\u88AB\u5360\u7528");
    }
    return fail(c, 500, "internal_error", message);
  });
  return app2;
}
var app = createApp();

// api/vercel-entry.ts
var config = { runtime: "nodejs" };
var vercel_entry_default = handle(app);
export {
  config,
  vercel_entry_default as default
};
