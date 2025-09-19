import { pgTable, text, uuid, timestamp, integer, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  html: text("html").notNull(),
  excerpt: text("excerpt"),
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
    parentReference: foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      onDelete: "cascade",
    }),
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
});

export const redirects = pgTable("redirects", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  status: integer("status").notNull().default(301),
});
