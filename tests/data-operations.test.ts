// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { dataOperationLogs, posts, comments } from "@/drizzle/schema";
import { eq, isNull } from "drizzle-orm";

// Mock the auth requirement
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(true),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-operation-id"),
}));

// Mock filesystem operations
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from("test data")),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock the backup script
vi.mock("@/scripts/backup", () => ({
  createBackup: vi.fn().mockResolvedValue("/tmp/test-backup.zip"),
}));

// Mock the restore script
vi.mock("@/scripts/restore", () => ({
  restoreBackup: vi.fn().mockResolvedValue({
    tables: {
      posts: { toInsert: 5, toUpdate: 2, toSkip: 0 },
      users: { toInsert: 1, toUpdate: 0, toSkip: 0 },
    },
    filteredRecords: { posts: 5, comments: 0 },
  }),
}));

describe("Data Operations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Export API", () => {
    it("should create export operation log", async () => {
      const { POST } = await import("@/app/api/admin/export/route");
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ includeMedia: true }),
        ip: "127.0.0.1",
        headers: {
          get: vi.fn((header: string) => {
            if (header === "user-agent") return "test-agent";
            if (header === "x-forwarded-for") return null;
            return null;
          }),
        },
      } as any;

      // Mock database operations
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "log-id" }]),
        }),
      });
      
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.spyOn(db, "insert").mockImplementation(mockInsert);
      vi.spyOn(db, "update").mockImplementation(mockUpdate);

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.operationId).toBe("test-operation-id");
      expect(mockInsert).toHaveBeenCalledWith(dataOperationLogs);
      expect(mockUpdate).toHaveBeenCalledWith(dataOperationLogs);
    });

    it("should handle export errors gracefully", async () => {
      const { POST } = await import("@/app/api/admin/export/route");
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({}),
        headers: { get: vi.fn(() => null) },
      } as any;

      // Mock createBackup to throw an error
      const { createBackup } = await import("@/scripts/backup");
      vi.mocked(createBackup).mockRejectedValue(new Error("Backup failed"));

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "log-id" }]),
        }),
      });
      
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.spyOn(db, "insert").mockImplementation(mockInsert);
      vi.spyOn(db, "update").mockImplementation(mockUpdate);

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.ok).toBe(false);
      expect(result.error.message).toBe("Backup failed");
    });
  });

  describe("Purge API", () => {
    it("should perform dry run soft delete for posts", async () => {
      const { POST } = await import("@/app/api/admin/purge/route");
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          type: "post",
          mode: "soft",
          dryRun: true,
          id: "123e4567-e89b-12d3-a456-426614174000", // Valid UUID
        }),
        headers: { get: vi.fn(() => null) },
      } as any;

      // Mock database operations
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "log-id" }]),
        }),
      });
      
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "123e4567-e89b-12d3-a456-426614174000", slug: "test-slug", title: "Test Post", createdAt: new Date() }
          ]),
        }),
      });

      vi.spyOn(db, "insert").mockImplementation(mockInsert);
      vi.spyOn(db, "update").mockImplementation(mockUpdate);
      vi.spyOn(db, "select").mockImplementation(mockSelect);

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.recordsAffected).toBe(1);
      expect(result.preview.type).toBe("post");
      expect(result.preview.mode).toBe("soft");
    });

    it("should require confirmation phrase for hard delete", async () => {
      const { POST } = await import("@/app/api/admin/purge/route");
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          type: "post",
          mode: "hard",
          dryRun: false,
          id: "123e4567-e89b-12d3-a456-426614174000", // Valid UUID
          confirmationPhrase: "wrong phrase",
        }),
        headers: { get: vi.fn(() => null) },
      } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.ok).toBe(false);
      expect(result.error.message).toContain("Hard delete requires confirmation phrase");
    });

    it("should validate request schema", async () => {
      const { POST } = await import("@/app/api/admin/purge/route");
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          type: "invalid-type",
          mode: "soft",
        }),
        headers: { get: vi.fn(() => null) },
      } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.ok).toBe(false);
      expect(result.error.message).toBe("Invalid request");
      expect(result.error.details).toBeDefined();
    });
  });

  describe("Restore API", () => {
    it("should handle restore with dry run", async () => {
      const { POST } = await import("@/app/api/admin/restore/route");
      
      const mockFile = {
        name: "test-backup.zip",
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      const mockFormData = {
        get: vi.fn((key: string) => {
          if (key === "backupFile") return mockFile;
          if (key === "dryRun") return "true";
          return null;
        }),
      };

      const mockRequest = {
        formData: vi.fn().mockResolvedValue(mockFormData),
        headers: { get: vi.fn(() => null) },
      } as any;

      // Mock database operations
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "log-id" }]),
        }),
      });
      
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.spyOn(db, "insert").mockImplementation(mockInsert);
      vi.spyOn(db, "update").mockImplementation(mockUpdate);

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.recordsAffected).toBe(8); // 5 + 2 + 1 from mock
    });

    it("should verify checksum when provided", async () => {
      const { POST } = await import("@/app/api/admin/restore/route");
      
      const mockFile = {
        name: "test-backup.zip",
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };

      const mockFormData = {
        get: vi.fn((key: string) => {
          if (key === "backupFile") return mockFile;
          if (key === "checksum") return "wrong-checksum";
          return null;
        }),
      };

      const mockRequest = {
        formData: vi.fn().mockResolvedValue(mockFormData),
        headers: { get: vi.fn(() => null) },
      } as any;

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "log-id" }]),
        }),
      });
      
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.spyOn(db, "insert").mockImplementation(mockInsert);
      vi.spyOn(db, "update").mockImplementation(mockUpdate);

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.ok).toBe(false);
      expect(result.error.message).toBe("Checksum verification failed");
    });
  });
});