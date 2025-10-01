// SPDX-License-Identifier: Apache-2.0
import { pgTable, text, uuid, timestamp, integer, foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pgEnum, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";

// Categories table (must be defined before posts table)
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  categoriesNameIndex: index("categories_name_idx").on(table.name),
}));

// Tags table
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  tagsNameIndex: index("tags_name_idx").on(table.name),
}));

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  bodyMd: text("body_md"), // Raw markdown content for editing
  bodyHtml: text("body_html"), // Rendered and sanitized HTML (nullable for migration)
  html: text("html").notNull(), // Legacy column - to be deprecated
  excerpt: text("excerpt"),
  importedSystemId: text("imported_system_id").unique(), // WordPress GUID for import idempotency
  // Featured image (post thumbnail)
  featuredImageUrl: text("featured_image_url"),
  featuredImageAlt: text("featured_image_alt"),
  viewsTotal: integer("views_total").notNull().default(0),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  // Post status fields
  isLocked: boolean("is_locked").notNull().default(false),
  // Soft delete columns
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name"),
  image: text("image"),
  login: text("login").unique(), // WordPress username for import mapping
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorEnforcedAt: timestamp("two_factor_enforced_at", { withTimezone: true }),
  mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }), // Last successful 2FA verification
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
    // Soft delete columns
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
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
  // Soft delete columns
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
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
    primaryKey: primaryKey({ columns: [table.day, table.postId] }),
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

export const pageViewEvents = pgTable(
  "page_view_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull(), // "/", "/about", "/category/tech", etc.
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
    pathTsIndex: index("page_view_events_path_ts_idx").on(table.path, table.ts),
    tsIndex: index("page_view_events_ts_idx").on(table.ts),
  })
);

export const pageDailyViews = pgTable(
  "page_daily_views",
  {
    day: text("day").notNull(), // DATE format YYYY-MM-DD
    path: text("path").notNull(),
    views: integer("views").notNull().default(0),
    uniques: integer("uniques").notNull().default(0),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.day, table.path] }),
    pathDayIndex: index("page_daily_views_path_day_idx").on(table.path, table.day),
  })
);

// Post-tag junction table
export const postTags = pgTable("post_tags", {
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tagId] }),
  postTagsPostIdIndex: index("post_tags_post_id_idx").on(table.postId),
  postTagsTagIdIndex: index("post_tags_tag_id_idx").on(table.tagId),
}));

// Comment-tag junction table (for admin tag management on comments)
export const commentTags = pgTable("comment_tags", {
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }).notNull(),
  tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.commentId, table.tagId] }),
  commentTagsCommentIdIndex: index("comment_tags_comment_id_idx").on(table.commentId),
  commentTagsTagIdIndex: index("comment_tags_tag_id_idx").on(table.tagId),
}));

// Import job status enum
export const importJobStatus = pgEnum("import_job_status", [
  "queued",
  "running", 
  "cancelling",
  "cancelled",
  "failed",
  "completed",
]);

// Import jobs table for tracking WXR imports
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: importJobStatus("status").notNull().default("queued"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Temporary file path
  options: jsonb("options").notNull(), // Import options (statuses, purge, etc.)
  
  // Progress counters
  totalItems: integer("total_items").notNull().default(0),
  postsImported: integer("posts_imported").notNull().default(0),
  attachmentsProcessed: integer("attachments_processed").notNull().default(0),
  redirectsCreated: integer("redirects_created").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  
  // Timestamps
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  
  // User who started the import
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
  importJobsStatusIndex: index("import_jobs_status_idx").on(table.status),
  importJobsCreatedAtIndex: index("import_jobs_created_at_idx").on(table.createdAt),
}));

// Import job errors table for detailed error logging
export const importJobErrors = pgTable("import_job_errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => importJobs.id, { onDelete: "cascade" }).notNull(),
  itemIdentifier: text("item_identifier").notNull(), // Post GUID, attachment URL, etc.
  errorType: text("error_type").notNull(), // "post_import", "media_download", "redirect_creation", etc.
  errorMessage: text("error_message").notNull(),
  itemData: jsonb("item_data"), // Relevant data for debugging
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  importJobErrorsJobIdIndex: index("import_job_errors_job_id_idx").on(table.jobId),
  importJobErrorsTypeIndex: index("import_job_errors_type_idx").on(table.errorType),
}));

// Data operation types for audit logging
export const dataOperationType = pgEnum("data_operation_type", [
  "export",
  "restore", 
  "purge_soft",
  "purge_hard",
]);

// Audit logs for export/restore/purge operations
export const dataOperationLogs = pgTable("data_operation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationType: dataOperationType("operation_type").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Operation details
  details: jsonb("details").notNull(), // Export options, restore file, purge filters, etc.
  
  // Results
  status: text("status").notNull(), // "started", "completed", "failed"
  recordsAffected: integer("records_affected").notNull().default(0),
  errorMessage: text("error_message"),
  
  // File/archive info for exports
  archiveFilename: text("archive_filename"),
  archiveChecksum: text("archive_checksum"),
  
  // IP address for security audit
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  dataOperationLogsUserIdIndex: index("data_operation_logs_user_id_idx").on(table.userId),
  dataOperationLogsTypeIndex: index("data_operation_logs_type_idx").on(table.operationType),
  dataOperationLogsCreatedAtIndex: index("data_operation_logs_created_at_idx").on(table.createdAt),
}));

// Two-Factor Authentication tables

// Owner TOTP configuration
export const ownerTotp = pgTable("owner_totp", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  secretBase32: text("secret_base32").notNull(), // Store encrypted in production
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  lastUsedStep: integer("last_used_step"), // For replay protection
});

// WebAuthn credentials (passkeys/security keys)
export const ownerWebAuthnCredential = pgTable("owner_webauthn_credential", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports"), // ["usb", "nfc", "ble", "internal"]
  aaguid: text("aaguid"),
  nickname: text("nickname"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (table) => ({
  ownerWebAuthnCredentialUserIdIndex: index("owner_webauthn_credential_user_id_idx").on(table.userId),
}));

// Recovery codes (hashed at rest)
export const ownerRecoveryCode = pgTable("owner_recovery_code", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  ownerRecoveryCodeUserIdIndex: index("owner_recovery_code_user_id_idx").on(table.userId),
}));

// Trusted devices for "remember this device" functionality
export const trustedDevice = pgTable("trusted_device", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).default(sql`now()`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => ({
  trustedDeviceUserIdIndex: index("trusted_device_user_id_idx").on(table.userId),
  trustedDeviceTokenHashIndex: index("trusted_device_token_hash_idx").on(table.tokenHash),
}));

// Security activity log (optional, local only)
export const securityActivity = pgTable("security_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  event: text("event").notNull(), // "2fa_enabled", "2fa_disabled", "passkey_added", etc.
  metadata: jsonb("metadata"), // Additional context
  timestamp: timestamp("timestamp", { withTimezone: true }).default(sql`now()`),
}, (table) => ({
  securityActivityUserIdIndex: index("security_activity_user_id_idx").on(table.userId),
  securityActivityTimestampIndex: index("security_activity_timestamp_idx").on(table.timestamp),
}));
