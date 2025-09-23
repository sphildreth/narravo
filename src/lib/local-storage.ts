// SPDX-License-Identifier: Apache-2.0
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

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
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.init();
    
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, body);
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
    
    // In a real implementation, this would return a URL for direct upload
    // For local storage, we'll handle uploads differently
    return {
      url: `/api/upload/local`, // This would need to be implemented
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