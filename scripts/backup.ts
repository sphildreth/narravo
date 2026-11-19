// SPDX-License-Identifier: Apache-2.0
import JSZip from "jszip";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { getStorageService } from "@/lib/s3";
import { archiveLimits, digest, mediaPrefixes, mediaType, names, storageFor, tables, validMediaKey, type BackupManifest } from "./content-archive";

export type { BackupManifest } from "./content-archive";
export interface BackupOptions {
  outputPath?: string | undefined;
  includeMedia?: boolean | undefined;
  verbose?: boolean | undefined;
}
export async function createBackup(options: BackupOptions = {}): Promise<string> {
  const output = options.outputPath ?? `backup-${new Date().toISOString().slice(0, 10)}.zip`;
  const zip = new JSZip();
  const manifest: BackupManifest = { version: 2, createdUtc: new Date().toISOString(), tables: {}, media: [], counts: {} };
  let total = 0;
  function add(path: string, data: string | Uint8Array) {
    const bytes = Buffer.byteLength(data);
    total += bytes;
    if (bytes > archiveLimits.entry || total > archiveLimits.expanded || Object.keys(zip.files).length >= archiveLimits.entries) {
      throw new Error("Content exceeds archive limits. Use pg_dump and a storage backup.");
    }
    zip.file(path, data, { createFolders: false });
  }
  await db.transaction(async (tx: typeof db) => {
    for (const name of names) {
      const rows = await tx.select().from(tables[name]);
      const json = JSON.stringify(rows);
      const filename = `db/${name}.json`;
      add(filename, json);
      manifest.tables[name] = { filename, recordCount: rows.length, sha256: digest(json) };
      manifest.counts[name] = rows.length;
    }
  }, { isolationLevel: "repeatable read", accessMode: "read only" });

  if (options.includeMedia !== false) {
    const stores = getStorageService() ? ["local", "cloud"] as const : ["local"] as const;
    for (const store of stores) {
      const storage = storageFor(store);
      for (const prefix of mediaPrefixes) {
        for (const key of await storage.listKeys(prefix)) {
          if (!validMediaKey(key)) throw new Error(`Unsupported media key: ${key}`);
          const bytes = await storage.getObjectBytes(key, archiveLimits.entry);
          mediaType(key, bytes);
          const path = `media/${store}/${key}`;
          add(path, bytes);
          manifest.media.push({ path, key, store, sha256: digest(bytes), bytes: bytes.length });
        }
      }
    }
  }
  add("manifest.json", JSON.stringify(manifest));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  if (buffer.length > archiveLimits.compressed) throw new Error("Backup exceeds compressed size limit");
  const temp = `${output}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, buffer, { mode: 0o600, flag: "wx" });
    await fs.rename(temp, output);
  } finally {
    await fs.rm(temp, { force: true });
  }
  if (options.verbose) logger.info("Exported records", manifest.counts);
  return output;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
  const skipMedia = process.argv.includes("--skip-media");
  const outputIndex = process.argv.findIndex(arg => arg === "--output" || arg === "-o");
  const outputPath = outputIndex !== -1 ? process.argv[outputIndex + 1] : undefined;

  createBackup({
    outputPath,
    includeMedia: !skipMedia,
    verbose,
  })
    .then(path => {
      logger.info(`✅ Backup created successfully: ${path}`);
      process.exit(0);
    })
    .catch(error => {
      logger.error("❌ Backup failed:", error);
      process.exit(1);
    });
}