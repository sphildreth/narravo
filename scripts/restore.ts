// SPDX-License-Identifier: Apache-2.0
import JSZip from "jszip";
import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { and, eq, getTableColumns, isNull, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { sanitizeHtml } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { archiveLimits, assertArchiveLimits, readArchiveEntry, digest, legacyNames, mediaType, names, storageFor, tables, validMediaKey, type BackupManifest, type MediaEntry, type TableName } from "./content-archive";

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
  const userIds = new Set([data.comments, data.reactions, data.uploads, data.posts]
    .flatMap(rows => rows.flatMap(r => [r.userId, r.deletedBy])).filter(Boolean));
  data.configuration = data.configuration.filter(row => userIds.has(row.userId));
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
  if ((options.startDate && !Number.isFinite(options.startDate.getTime())) ||
      (options.endDate && !Number.isFinite(options.endDate.getTime())) ||
      (options.startDate && options.endDate && options.startDate > options.endDate)) {
    throw new Error("Invalid restore date range");
  }
  if (options.filterSlugs && (!options.filterSlugs.length || options.filterSlugs.some(slug => !slug.trim()))) {
    throw new Error("A slug filter requires a nonempty list of slugs");
  }
  const stat = await fs.stat(options.backupPath);
  if (stat.size > archiveLimits.compressed) throw new Error("Backup exceeds compressed size limit");
  const buffer = await fs.readFile(options.backupPath);
  const zip = await JSZip.loadAsync(buffer);
  assertArchiveLimits(zip, buffer.length);
  const manifest: BackupManifest = JSON.parse((await readArchiveEntry(zip, "manifest.json")).toString("utf8"));
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
    const json = (await readArchiveEntry(zip, entry.filename)).toString("utf8");
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
  const mediaPaths = new Set<string>();
  for (const entry of options.skipMedia ? [] : manifest.media) {
    // Version 1 contained only URL hashes. Its files must be recovered separately.
    if (manifest.version === 1) throw new Error("Legacy ZIP contains media placeholders. Recover the media from storage and retry with --skip-media.");
    if (!validMediaKey(entry.key) || entry.path !== `media/${entry.store}/${entry.key}`) throw new Error("Invalid media path");
    if (mediaPaths.has(entry.path)) throw new Error("Duplicate media entry");
    mediaPaths.add(entry.path);
    if (selective && !selectedContent.includes(entry.key)) continue;
    const bytes = await readArchiveEntry(zip, entry.path);
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
          if (name === "users" && !existing && record.twoFactorEnabled === true) {
            throw new Error("Restore or enroll the account's second factor before importing its content");
          }
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
async function runCli() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  try {
    const { values, positionals } = parseArgs({
      args, allowPositionals: true, options: {
        "dry-run": { type: "boolean" }, verbose: { type: "boolean", short: "v" },
        slugs: { type: "string" }, "start-date": { type: "string" }, "end-date": { type: "string" },
        "skip-media": { type: "boolean" }, "skip-users": { type: "boolean" }, "skip-config": { type: "boolean" },
      },
    });
    if (positionals.length !== 1) throw new Error("Usage: pnpm restore <backup.zip> [--dry-run] [--slugs list] [--start-date date] [--end-date date] [--skip-media] [--skip-users] [--skip-config] [--verbose]");
    const preview = await restoreBackup({
      backupPath: positionals[0]!,
      dryRun: !!values["dry-run"], verbose: !!values.verbose,
      skipMedia: !!values["skip-media"], skipUsers: !!values["skip-users"], skipConfiguration: !!values["skip-config"],
      ...(values.slugs !== undefined ? { filterSlugs: values.slugs.split(",").map(s => s.trim()) } : {}),
      ...(values["start-date"] !== undefined ? { startDate: new Date(values["start-date"]) } : {}),
      ...(values["end-date"] !== undefined ? { endDate: new Date(values["end-date"]) } : {}),
    });
    if (values["dry-run"] && !values.verbose) logger.info("Restore preview", preview.tables);
    logger.info(values["dry-run"] ? "Restore preview complete" : "Restore completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Restore failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void runCli();
