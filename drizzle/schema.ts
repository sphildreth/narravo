// SPDX-License-Identifier: Apache-2.0
import { pgTable, text, uuid, timestamp, integer, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pgEnum, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  bodyMd: text("body_md"), // Raw markdown content for editing
  bodyHtml: text("body_html"), // Rendered and sanitized HTML (nullable for migration)
  html: text("html").notNull(), // Legacy column - to be deprecated
  excerpt: text("excerpt"),
  guid: text("guid").unique(), // WordPress GUID for import idempotency
  viewsTotal: integer("views_total").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name"),
  image: text("image"),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    path: text("path").notNull(),
    depth: integer("depth").notNull().default(0),
    bodyHtml: text("body_html").notNull(),
    bodyMd: text("body_md"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => ({
    parentReference: foreignKey({ columns: [table.parentId], foreignColumns: [table.id] }).onDelete("cascade"),
  })
);

export const commentAttachments = pgTable("comment_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // image|video
  url: text("url").notNull(),
  posterUrl: text("poster_url"),
  mime: text("mime"),
  bytes: integer("bytes"),
});

export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  reactionsUniqueConstraint: uniqueIndex("reactions_unique_constraint").on(
    table.targetType, table.targetId, table.userId, table.kind
  ),
}));

export const redirects = pgTable("redirects", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  status: integer("status").notNull().default(301),
});

// Configuration
export const configValueType = pgEnum("config_value_type", [
  "string",
  "integer",
  "number",
  "boolean",
  "date",
  "datetime",
  "json",
]);

export const configuration = pgTable(
  "configuration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: configValueType("type").notNull(),
    value: jsonb("value").notNull(),
    allowedValues: jsonb("allowed_values"),
    required: boolean("required").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  },
  (table) => ({
    configurationKeyUserIdx: index("configuration_key_user_idx").on(table.key, table.userId),
    configurationKeyUserUniq: uniqueIndex("configuration_key_user_uniq").on(table.key, table.userId),
    configurationGlobalKeyUniq: uniqueIndex("configuration_global_key_uniq").on(table.key).where(sql`"user_id" is null`),
  })
);

export const postDailyViews = pgTable(
  "post_daily_views",
  {
    day: text("day").notNull(), // DATE format YYYY-MM-DD
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
    views: integer("views").notNull().default(0),
    uniques: integer("uniques").notNull().default(0),
  },
  (table) => ({
    primaryKey: { columns: [table.day, table.postId] },
    postIdDayIndex: index("post_daily_views_post_id_day_idx").on(table.postId, table.day),
  })
);

export const postViewEvents = pgTable(
  "post_view_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
    ts: timestamp("ts", { withTimezone: true }).default(sql`now()`),
    sessionId: text("session_id"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referrerHost: text("referrer_host"),
    referrerPath: text("referrer_path"),
    userLang: text("user_lang"),
    bot: boolean("bot").notNull().default(false),
  },
  (table) => ({
    postIdTsIndex: index("post_view_events_post_id_ts_idx").on(table.postId, table.ts),
  })
);
