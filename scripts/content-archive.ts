// SPDX-License-Identifier: Apache-2.0
import type JSZip from "jszip";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { categories, tags, users, posts, comments, commentAttachments, reactions, redirects, configuration, postTags, commentTags, uploads } from "@/drizzle/schema";
import { localStorageService } from "@/lib/local-storage";
import { getStorageService } from "@/lib/s3";
import { detectSafeUploadType } from "@/lib/upload-validation";

export const tables = { users, categories, tags, posts, comments, comment_attachments: commentAttachments, post_tags: postTags, comment_tags: commentTags, reactions, redirects, uploads, configuration };
export type TableName = keyof typeof tables;
export const names = Object.keys(tables) as TableName[];
export const legacyNames = ["posts", "users", "comments", "comment_attachments", "reactions", "redirects", "configuration"] as const;
export const digest = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
export const archiveLimits = { compressed: 100 * 1024 ** 2, expanded: 250 * 1024 ** 2, entry: 50 * 1024 ** 2, entries: 4096 };
export const mediaPrefixes = ["images", "videos", "featured", "imported-media", "banner", "uploads"];
export interface MediaEntry { path: string; key: string; store: "local" | "cloud"; sha256: string; bytes: number; }
export interface BackupManifest {
  version: number;
  createdUtc: string;
  tables: Record<string, { filename: string; recordCount: number; sha256: string }>;
  media: MediaEntry[];
  counts: Record<string, number>;
}
export function validMediaKey(key: string) {
  const parts = key.split("/");
  return parts.length >= 2 && mediaPrefixes.includes(parts[0]!) && parts.every(p => /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(p));
}
export function mediaType(key: string, data: Uint8Array) {
  const type = detectSafeUploadType(data);
  const extension = key.split(".").pop()?.toLowerCase().replace(/^jpeg$/, "jpg");
  if (!type || type.extension !== extension) throw new Error(`Unsupported media file: ${key}`);
  return type.mimeType;
}
export function storageFor(store: MediaEntry["store"]) {
  if (store === "local") return localStorageService;
  if (store !== "cloud") throw new Error("Invalid media storage type");
  const cloud = getStorageService();
  if (!cloud) throw new Error("Configure the archive's S3/R2 storage before restoring cloud media");
  return cloud;
}
// JSZip exposes the central directory length on entries loaded from a ZIP.
function declaredEntrySize(entry: JSZip.JSZipObject): number {
  const size = (entry as unknown as { _data: { uncompressedSize: number } })._data.uncompressedSize;
  if (!Number.isSafeInteger(size) || size < 0 || size > archiveLimits.entry) throw new Error("Invalid archive entry size");
  return size;
}

export async function readArchiveEntry(zip: JSZip, path: string): Promise<Buffer> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`Missing archive entry: ${path}`);
  const limit = declaredEntrySize(entry);
  const stream = new Readable().wrap(entry.nodeStream());
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > limit) throw new Error(`Archive entry exceeds declared size: ${path}`);
    chunks.push(chunk);
  }
  if (total !== limit) throw new Error(`Incomplete archive entry: ${path}`);
  return Buffer.concat(chunks, total);
}
export function assertArchiveLimits(zip: JSZip, archiveBytes?: number) {
  if (archiveBytes !== undefined && (archiveBytes <= 0 || archiveBytes > archiveLimits.compressed)) throw new Error("Backup exceeds compressed size limit");
  const entries = Object.values(zip.files);
  if (entries.length > archiveLimits.entries) throw new Error("Backup contains too many entries");
  let total = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    total += declaredEntrySize(entry);
    if (total > archiveLimits.expanded) throw new Error("Backup exceeds expansion limit");
  }
}
