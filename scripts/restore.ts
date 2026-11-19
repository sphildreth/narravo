// SPDX-License-Identifier: Apache-2.0
import JSZip from "jszip";
import fs from "node:fs/promises";
import { and, eq, getTableColumns, isNull, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { sanitizeHtml } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { archiveLimits, assertArchiveLimits, digest, legacyNames, mediaType, names, storageFor, tables, validMediaKey, type BackupManifest, type MediaEntry, type TableName } from "./content-archive";

export interface RestoreOptions {
  backupPath: string;
  dryRun?: boolean;
  filterSlugs?: string[];
  startDate?: Date;
  endDate?: Date;
  verbose?: boolean;
  skipMedia?: boolean;
  skipUsers?: boolean;
  skipConfiguration?: boolean;
}

export interface RestorePreview {
  tables: {
    [tableName: string]: {
      toInsert: number;
      toUpdate: number;
      toSkip: number;
    };
  };
  filteredRecords: {
    posts: number;
    comments: number;
  };
}

type Row = Record<string, any>;
type Data = Record<TableName, Row[]>;

function selectRecords(data: Data, options: RestoreOptions) {
  if (!options.filterSlugs?.length && !options.startDate && !options.endDate) return false;
  data.posts = data.posts.filter(post => {
    if (options.filterSlugs?.length && !options.filterSlugs.includes(post.slug)) return false;
    if (!options.startDate && !options.endDate) return true;
    if (!post.publishedAt) return false;
    const time = new Date(post.publishedAt);
    return (!options.startDate || time >= options.startDate) && (!options.endDate || time <= options.endDate);
  });
  const postIds = new Set(data.posts.map(p => p.id));
  const paths = new Set(data.posts.map(p => "/" + p.slug));
  data.comments = data.comments.filter(c => postIds.has(c.postId));
  const commentIds = new Set(data.comments.map(c => c.id));
  data.comment_attachments = data.comment_attachments.filter(a => commentIds.has(a.commentId));
  data.post_tags = data.post_tags.filter(t => postIds.has(t.postId));
  data.comment_tags = data.comment_tags.filter(t => commentIds.has(t.commentId));
  data.reactions = data.reactions.filter(r => (r.targetType === "post" ? postIds : commentIds).has(r.targetId));
  data.uploads = data.uploads.filter(u => postIds.has(u.postId));
  data.redirects = data.redirects.filter(r => paths.has(r.toPath));
  const categories = new Set(data.posts.map(p => p.categoryId));
  data.categories = data.categories.filter(c => categories.has(c.id));
  const tags = new Set([...data.post_tags, ...data.comment_tags].map(t => t.tagId));
  data.tags = data.tags.filter(t => tags.has(t.id));
  const userIds = new Set(Object.values(data).flatMap(rows => rows.flatMap(r => [r.userId, r.deletedBy])));
  data.users = data.users.filter(u => userIds.has(u.id));
  return true;
}

function orderComments(rows: Row[]) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const done = new Set<string>();
  const ordered: Row[] = [];
  for (const row of rows) {
    const parents = new Set<string>();
    let node: Row | undefined = row;
    while (node && !done.has(node.id)) {
      if (parents.has(node.id)) throw new Error("Comment parent cycle in archive");
      parents.add(node.id);
      node = byId.get(node.parentId);
    }
    for (const id of [...parents].reverse()) {
      ordered.push(byId.get(id)!);
      done.add(id);
    }
  }
  return ordered;
}

function matchRecord(name: TableName, cols: Record<string, PgColumn>, row: Row): SQL {
  const same = (key: string) => row[key] == null ? isNull(cols[key]!) : eq(cols[key]!, row[key]);
  switch (name) {
    case "posts": return row.importedSystemId ? or(same("importedSystemId"), same("slug"))! : same("slug");
    case "users": return row.email ? same("email") : same("id");
    case "categories": case "tags": return same("slug");
    case "uploads": return same("key");
    case "configuration": return and(same("key"), same("userId"))!;
    case "redirects": return same("fromPath");
    case "reactions": return and(same("targetType"), same("targetId"), same("userId"), same("kind"))!;
    case "post_tags": return and(same("postId"), same("tagId"))!;
    case "comment_tags": return and(same("commentId"), same("tagId"))!;
    default: return same("id");
  }
}

const references: Record<string, TableName> = {
  userId: "users", deletedBy: "users", categoryId: "categories", tagId: "tags",
  postId: "posts", commentId: "comments", parentId: "comments",
};

export async function restoreBackup(options: RestoreOptions): Promise<RestorePreview> {
  const stat = await fs.stat(options.backupPath);
  if (stat.size > archiveLimits.compressed) throw new Error("Backup exceeds compressed size limit");
  const buffer = await fs.readFile(options.backupPath);
  const zip = await JSZip.loadAsync(buffer);
  assertArchiveLimits(zip, buffer.length);
  const manifest: BackupManifest = JSON.parse(await zip.file("manifest.json")?.async("string") ?? "null");
  if (!manifest || ![1, 2].includes(manifest.version) || !manifest.tables || !Array.isArray(manifest.media)) {
    throw new Error("Invalid or unsupported backup manifest");
  }
  const required = new Set<string>(manifest.version === 1 ? legacyNames : names);
  const data = {} as Data;
  for (const name of names) {
    const entry = manifest.tables[name];
    data[name] = [];
    if (!entry && !required.has(name)) continue;
    if (!entry || entry.filename !== `db/${name}.json`) throw new Error(`Missing table: ${name}`);
    const json = await zip.file(entry.filename)?.async("string");
    if (!json || digest(json) !== entry.sha256) throw new Error(`Failed checksum for ${name}`);
    const rows = JSON.parse(json);
    if (!Array.isArray(rows) || rows.length !== entry.recordCount || rows.some(r => !r || typeof r !== "object" || Array.isArray(r))) {
      throw new Error(`Invalid table: ${name}`);
    }
    data[name] = rows;
  }
  if (options.skipConfiguration) data.configuration = [];
  const selective = selectRecords(data, options);
  data.comments = orderComments(data.comments);
  const selectedContent = selective ? JSON.stringify(data) : "";
  const media: Array<{ entry: MediaEntry; bytes: Uint8Array; mime: string; storage: ReturnType<typeof storageFor> }> = [];
  for (const entry of options.skipMedia ? [] : manifest.media) {
    // Version 1 contained only URL hashes. Its files must be recovered separately.
    if (manifest.version === 1) throw new Error("Legacy ZIP contains media placeholders. Recover the media from storage and retry with --skip-media.");
    if (!validMediaKey(entry.key) || entry.path !== `media/${entry.store}/${entry.key}`) throw new Error("Invalid media path");
    if (selective && !selectedContent.includes(entry.key)) continue;
    const bytes = await zip.file(entry.path)?.async("uint8array");
    if (!bytes || bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error(`Invalid media: ${entry.key}`);
    media.push({ entry, bytes, mime: mediaType(entry.key, bytes), storage: storageFor(entry.store) });
  }

  const preview: RestorePreview = { tables: {}, filteredRecords: { posts: data.posts.length, comments: data.comments.length } };
  const dryRunComplete = new Error("Roll back preview");
  const ids = new Map<string, string>();
  try {
    await db.transaction(async (tx: typeof db) => {
      for (const name of names) {
        const table = tables[name];
        const columns: Record<string, PgColumn> = getTableColumns(table);
        const counts = preview.tables[name] = { toInsert: 0, toUpdate: 0, toSkip: 0 };
        for (const record of data[name]) {
          const row: Row = {};
          for (const [key, col] of Object.entries(columns)) {
            const value = record[key];
            if (value === undefined) continue;
            const target = key === "targetId" ? (record.targetType === "post" ? "posts" : "comments") : references[key];
            row[key] = value != null && col.dataType === "date" ? new Date(value)
              : target ? ids.get(`${target}/${value}`) ?? value : value;
          }
          if (name === "users") {
            delete row.twoFactorEnabled;
            delete row.twoFactorEnforcedAt;
            delete row.mfaVerifiedAt;
          }
          if (name === "posts" || name === "comments") {
            for (const key of ["html", "bodyHtml", "excerpt"]) {
              if (typeof row[key] === "string") row[key] = sanitizeHtml(row[key]);
            }
          }
          if (name === "configuration" && row.key === "SITE.DISCLAIMER.STYLE") { counts.toSkip++; continue; }
          if (name === "configuration" && row.key === "SITE.DISCLAIMER.TEXT" && typeof row.value === "string") row.value = sanitizeHtml(row.value);
          const match = matchRecord(name, columns, row);
          const matches = await tx.select().from(table).where(match).limit(2);
          if (matches.length > 1) throw new Error(`Ambiguous identity in ${name}`);
          const existing = matches[0];
          if (existing?.id && row.id) ids.set(`${name}/${row.id}`, existing.id);
          if (name === "users" && options.skipUsers) { counts.toSkip++; continue; }
          if (existing && !row.id) { counts.toSkip++; continue; }
          if (existing) {
            delete row.id;
            await tx.update(table).set(row).where(match);
            counts.toUpdate++;
          } else {
            await tx.insert(table).values(row);
            counts.toInsert++;
          }
        }
      }
      for (const { entry, bytes, storage, mime } of media) {
        let existing: Uint8Array | undefined;
        try {
          existing = await storage.getObjectBytes(entry.key, archiveLimits.entry);
        } catch (error) {
          const e = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
          if (e.code !== "ENOENT" && e.name !== "NoSuchKey" && e.$metadata?.httpStatusCode !== 404) throw error;
        }
        if (existing && digest(existing) !== entry.sha256) throw new Error(`Conflicting media file: ${entry.key}`);
        if (!existing && !options.dryRun) await storage.putObject(entry.key, bytes, mime, true);
      }
      if (options.dryRun) throw dryRunComplete;
    });
  } catch (error) {
    if (error !== dryRunComplete) throw error;
  }
  if (options.verbose) logger.info("Restore counts", preview.tables);
  return preview;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const backupPath = args.filter(arg => arg !== "--")[0];
  
  if (!backupPath) {
    logger.error("Usage: tsx scripts/restore.ts <backup.zip> [options]");
    logger.error("Options:");
    logger.error("  --dry-run          Preview changes without applying them");
    logger.error("  --verbose, -v      Enable verbose output");
    logger.error("  --slugs slug1,slug2  Restore only specific posts by slug");
    logger.error("  --start-date YYYY-MM-DD  Restore posts from this date onwards");
    logger.error("  --end-date YYYY-MM-DD    Restore posts up to this date");
    logger.error("  --skip-users       Skip restoring users");
    logger.error("  --skip-config      Skip restoring configuration");
    process.exit(1);
  }

  const options: RestoreOptions = {
    backupPath,
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    skipMedia: args.includes("--skip-media"),
    skipUsers: args.includes("--skip-users"),
    skipConfiguration: args.includes("--skip-config"),
  };

  // Parse slugs filter
  const slugsIndex = args.findIndex(arg => arg === "--slugs");
  if (slugsIndex !== -1) {
    const slugsArg = args[slugsIndex + 1];
    if (slugsArg) {
      options.filterSlugs = slugsArg.split(",");
    }
  }

  // Parse date filters
  const startDateIndex = args.findIndex(arg => arg === "--start-date");
  if (startDateIndex !== -1) {
    const startDateArg = args[startDateIndex + 1];
    if (startDateArg) {
      options.startDate = new Date(startDateArg);
    }
  }

  const endDateIndex = args.findIndex(arg => arg === "--end-date");
  if (endDateIndex !== -1) {
    const endDateArg = args[endDateIndex + 1];
    if (endDateArg) {
      options.endDate = new Date(endDateArg);
    }
  }

  restoreBackup(options)
    .then(() => {
      logger.info("✅ Restore completed successfully");
      process.exit(0);
    })
    .catch(error => {
      logger.error("❌ Restore failed:", error);
      process.exit(1);
    });
}
