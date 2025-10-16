// SPDX-License-Identifier: Apache-2.0
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import logger from "./logger";

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
    
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    
    logger.info(`[LocalStorage] putObject - key: ${key}, size: ${body.length} bytes, type: ${contentType}`);
    logger.info(`[LocalStorage] Target file path: ${filePath}`);
    
    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      logger.info(`[LocalStorage] Directory ensured: ${dir}`);
      
      // Write file
      await fs.writeFile(filePath, body);
      logger.info(`[LocalStorage] File written successfully: ${filePath}`);
      
      // Verify file was written
      const stats = await fs.stat(filePath);
      logger.info(`[LocalStorage] File verification - size: ${stats.size} bytes, mode: ${stats.mode.toString(8)}`);
    } catch (error) {
      logger.error(`[LocalStorage] Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    // Return URL path that will be served by Next.js static files
    return `${this.baseUrl}/${key}`;
  }

  async createPresignedPost(
    filename: string,
    mimeType: string,
    options: { keyPrefix?: string }
  ): Promise<{ url: string; key: string; fields: Record<string, string> }> {
    // For local storage, we'll use a simulated presigned post
    const ext = filename.split('.').pop() || '';
    const key = `${options.keyPrefix || 'uploads'}/${nanoid()}.${ext}`;
    
    // In development, upload via same-origin API route
    return {
      url: `/api/uploads/local`,
      key,
      fields: {
        'Content-Type': mimeType,
        'key': key,
      },
    };
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, key);
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
    const target = path.resolve(this.uploadDir, prefix);
    if (!target.startsWith(this.uploadDir)) {
      // Do not allow deleting outside uploadDir
      return;
    }
    await fs.rm(target, { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadDir, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Default instance for local development
export const localStorageService = new LocalStorageService();