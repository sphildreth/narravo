// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageService } from "@/lib/local-storage";
import fs from "node:fs/promises";
import path from "node:path";

// Mock fs and path modules
vi.mock("node:fs/promises");
vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof import("node:path")>("node:path");
  return {
    ...actual,
    resolve: vi.fn((...args) => actual.resolve(...args)),
  };
});

describe("LocalStorageService", () => {
  let service: LocalStorageService;
  const mockUploadDir = "/test/uploads";
  const mockBaseUrl = "/uploads";

  beforeEach(() => {
    service = new LocalStorageService(mockUploadDir, mockBaseUrl);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("init", () => {
    it("should create upload directory if it doesn't exist", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      
      await service.init();
      
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe("putObject", () => {
    it("should write file to correct path", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      const key = "test/file.jpg";
      const body = new Uint8Array([1, 2, 3]);
      const contentType = "image/jpeg";
      
      await service.putObject(key, body, contentType);
      
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), body);
    });

    it("should create nested directories", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      const key = "nested/path/file.jpg";
      const body = new Uint8Array([1, 2, 3]);
      
      await service.putObject(key, body, "image/jpeg");
      
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe("getPublicUrl", () => {
    it("should return correct public URL", () => {
      const key = "test/file.jpg";
      const url = service.getPublicUrl(key);
      
      expect(url).toBe("/uploads/test/file.jpg");
    });

    it("should handle keys without slashes", () => {
      const key = "file.jpg";
      const url = service.getPublicUrl(key);
      
      expect(url).toBe("/uploads/file.jpg");
    });
  });

  describe("createPresignedPost", () => {
    it("should generate upload URL with safe filename", async () => {
      const result = await service.createPresignedPost("test file!.jpg", "image/jpeg", {});
      
      expect(result.key).toMatch(/^uploads\/[a-zA-Z0-9_-]+\.jpg$/);
      expect(result.url).toBe(`/api/uploads/local`);
      expect(result.fields).toHaveProperty('Content-Type', 'image/jpeg');
      expect(result.fields).toHaveProperty('key');
    });

    it("should preserve file extension", async () => {
      const result = await service.createPresignedPost("document.pdf", "application/pdf", {});
      
      expect(result.key).toMatch(/^uploads\/.+\.pdf$/);
    });

    it("should handle files without extension", async () => {
      const result = await service.createPresignedPost("testfile", "text/plain", {});
      
      // Files without extension get the whole filename as the extension
      expect(result.key).toMatch(/^uploads\/[a-zA-Z0-9_-]+/);
    });
  });

  describe("deleteObject", () => {
    it("should delete file", async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      
      await service.deleteObject("test/file.jpg");
      
      expect(fs.unlink).toHaveBeenCalledWith(expect.any(String));
    });

    it("should ignore ENOENT errors", async () => {
      const error = new Error("File not found") as any;
      error.code = "ENOENT";
      vi.mocked(fs.unlink).mockRejectedValue(error);
      
      await expect(service.deleteObject("nonexistent.jpg")).resolves.not.toThrow();
    });

    it("should throw other errors", async () => {
      const error = new Error("Permission denied") as any;
      error.code = "EACCES";
      vi.mocked(fs.unlink).mockRejectedValue(error);
      
      await expect(service.deleteObject("test.jpg")).rejects.toThrow("Permission denied");
    });
  });

  describe("deletePrefix", () => {
    it("should delete directory with prefix", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);
      
      await service.deletePrefix("test-prefix");
      
      expect(fs.rm).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        force: true,
      });
    });

    it("should not delete root prefix", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);
      
      await service.deletePrefix("/");
      
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should not delete empty prefix", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);
      
      await service.deletePrefix("");
      
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should not delete outside upload directory", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);
      
      await service.deletePrefix("../../../etc");
      
      expect(fs.rm).not.toHaveBeenCalled();
    });
  });

  describe("exists", () => {
    it("should return true if file exists", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      const result = await service.exists("test/file.jpg");
      
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(expect.any(String));
    });

    it("should return false if file does not exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      
      const result = await service.exists("nonexistent.jpg");
      
      expect(result).toBe(false);
    });
  });
});
