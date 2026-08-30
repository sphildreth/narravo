// SPDX-License-Identifier: Apache-2.0
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import logger from "./logger";
import { getSafeUploadTypeByMime } from "./upload-validation";

/**
 * Local filesystem storage service for development environments without S3/R2
 */
export class LocalStorageService {
  private uploadDir: string;
  private baseUrl: string;

  constructor(uploadDir: string = "public/uploads", baseUrl: string = "/uploads") {
    this.uploadDir = path.resolve(uploadDir);
    this.baseUrl = baseUrl;
  }

  async init(): Promise<void> {
    // Ensure upload directory exists
    logger.info(`[LocalStorage] Initializing upload directory: ${this.uploadDir}`);
    await fs.mkdir(this.uploadDir, { recursive: true });
    logger.info(`[LocalStorage] Upload directory ready: ${this.uploadDir}`);
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.init();

    const filePath = this.resolveContainedPath(key);
    const dir = path.dirname(filePath);
    
    logger.info(`[LocalStorage] putObject - key: ${key}, size: ${body.length} bytes, type: ${contentType}`);
    logger.info(`[LocalStorage] Target file path: ${filePath}`);
    let temporaryPath: string | null = null;
    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      logger.info(`[LocalStorage] Directory ensured: ${dir}`);

      // A lexically safe key can still traverse through a pre-existing
      // symlinked directory. Resolve the directory after creation and apply
      // the same containment check before writing.
      const resolvedDir = await fs.realpath(dir);
      const relativeDir = path.relative(this.uploadDir, resolvedDir);
      if (relativeDir === ".." || relativeDir.startsWith(`..${path.sep}`) || path.isAbsolute(relativeDir)) {
        throw new Error("Invalid storage key");
      }
      
      // Write beside the final path and rename atomically so a failed import
      // or upload can never expose a partially written object.
      temporaryPath = path.join(dir, `.upload-${nanoid()}.tmp`);
      await fs.writeFile(temporaryPath, body);
      await fs.rename(temporaryPath, filePath);
      temporaryPath = null;
      logger.info(`[LocalStorage] File written successfully: ${filePath}`);
      
      // Verify file was written
      const stats = await fs.stat(filePath);
      logger.info(`[LocalStorage] File verification - size: ${stats.size} bytes, mode: ${stats.mode.toString(8)}`);
    } catch (error) {
      if (temporaryPath) {
        await fs.unlink(temporaryPath).catch(() => undefined);
      }
      logger.error(`[LocalStorage] Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    this.resolveContainedPath(key);
    // Return URL path that will be served by Next.js static files
    return `${this.baseUrl}/${key}`;
  }

  async createPresignedPost(
    filename: string,
    mimeType: string,
    options: { keyPrefix?: string }
  ): Promise<{ url: string; key: string; fields: Record<string, string> }> {
    // This policy is only a transport convenience. The receiving endpoint
    // still detects the actual bytes and generates the final key.
    const detected = getSafeUploadTypeByMime(mimeType);
    if (!detected) throw new Error(`MIME type ${mimeType} is not supported`);
    const keyPrefix = options.keyPrefix === "videos" ? "videos" : options.keyPrefix === "featured" ? "featured" : "images";
    const key = `${keyPrefix}/${nanoid()}.${detected.extension}`;
    
    // In development, upload via same-origin API route
    return {
      url: `/api/uploads/local`,
      key,
      fields: {
        'Content-Type': detected.mimeType,
        'key': key,
      },
    };
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const filePath = this.resolveContainedPath(key);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore file not found errors
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // New: delete all files under a given prefix (e.g., "imported-media")
  async deletePrefix(prefix: string): Promise<void> {
    if (!prefix || prefix === "/") return; // safety guard
    // Resolve target under uploadDir and ensure containment
    let target: string;
    try {
      target = this.resolveContainedPath(prefix);
    } catch {
      return;
    }
    await fs.rm(target, { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveContainedPath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private resolveContainedPath(key: string): string {
    if (!key || key.includes("\0") || key.includes("\\")) {
      throw new Error("Invalid storage key");
    }
    const candidate = path.resolve(this.uploadDir, key);
    const relative = path.relative(this.uploadDir, candidate);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Invalid storage key");
    }
    return candidate;
  }
}

// Default instance for local development
export const localStorageService = new LocalStorageService();
