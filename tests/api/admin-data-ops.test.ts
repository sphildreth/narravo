// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as exportPost } from "@/app/api/admin/export/route";
import { GET as exportStatusGet } from "@/app/api/admin/export/[operationId]/route";
import { POST as restorePost } from "@/app/api/admin/restore/route";

const mockRequireAdmin = vi.fn();
const mockCreateBackup = vi.fn();
const mockRestoreBackup = vi.fn();
const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
};

const mockDb = {
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock(new URL("../../scripts/backup.ts", import.meta.url).href, () => ({
  createBackup: (...args: unknown[]) => mockCreateBackup(...args),
}));

vi.mock(new URL("../../scripts/restore.ts", import.meta.url).href, () => ({
  restoreBackup: (...args: unknown[]) => mockRestoreBackup(...args),
}));

vi.mock("node:fs/promises", () => mockFs);

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("nanoid", () => ({ nanoid: () => "operation-123456" }));

const mockResponseJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

describe("admin data operation routes", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1" } });

    mockCreateBackup.mockReset();
    mockRestoreBackup.mockReset();
    mockFs.readFile.mockReset();
    mockFs.writeFile.mockReset();
    mockFs.unlink.mockReset();

    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-01T12:34:56Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeJsonRequest = (body: unknown, init: RequestInit = {}): NextRequest => {
    const request = new Request("http://localhost/api", {
      method: init.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      body: JSON.stringify(body),
    });
    return request as unknown as NextRequest;
  };

  it("starts export jobs and records metadata", async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: "log-1" }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    mockDb.insert.mockReturnValue({ values: insertValues });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set: updateSet });

    mockCreateBackup.mockResolvedValue("/tmp/narravo-export.zip");
    mockFs.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const request = makeJsonRequest({ includeMedia: false, dateFrom: "2024-02-01", dateTo: "2024-02-15" });

    const response = await exportPost(request);
    const payload = await mockResponseJson(response);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.operationId).toBe("operation-123456");
    expect(payload.filename).toBe("narravo-export-20240301-operatio.zip");
    expect(mockCreateBackup).toHaveBeenCalledWith({
      outputPath: "/tmp/narravo-export-20240301-operatio.zip",
      includeMedia: false,
      verbose: false,
    });
    expect(mockFs.readFile).toHaveBeenCalledWith("/tmp/narravo-export.zip");
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
      archiveFilename: expect.stringContaining("narravo-export-20240301-operatio"),
      archiveChecksum: expect.any(String),
    }));
  });

  it("marks export failures and returns error", async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: "log-2" }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    mockDb.insert.mockReturnValue({ values: insertValues });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set: updateSet });

    mockCreateBackup.mockRejectedValue(new Error("Export failed"));

    const response = await exportPost(makeJsonRequest({ includeMedia: true }));
    const payload = await mockResponseJson(response);

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", errorMessage: "Export failed" }));
  });

  it("returns export status metadata", async () => {
    const operationRecord = {
      status: "completed",
      archiveFilename: "narravo-export-20240301-operation-1234.zip",
      archiveChecksum: "abc123",
      createdAt: new Date("2024-03-01T12:00:00Z"),
      completedAt: new Date("2024-03-01T12:10:00Z"),
      errorMessage: null,
      details: { includeMedia: true },
    };

    mockDb.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [operationRecord],
        }),
      }),
    }));

    const request = {
      nextUrl: new URL("http://localhost/api/admin/export/operation-123456"),
      headers: new Headers(),
    } as unknown as NextRequest;
    const response = await exportStatusGet(request, { params: Promise.resolve({ operationId: "operation-123456" }) });
    const payload = await mockResponseJson(response);

    expect(response.status).toBe(200);
    expect(payload.operation).toEqual(expect.objectContaining({
      id: "operation-123456",
      status: "completed",
      filename: "narravo-export-20240301-operation-1234.zip",
    }));
  });

  it("serves export downloads when available", async () => {
    const operationRecord = {
      status: "completed",
      archiveFilename: "narravo-export-20240301-operation-1234.zip",
      archiveChecksum: "abc123",
      createdAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
      details: {},
    };

    mockDb.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [operationRecord],
        }),
      }),
    }));

    const fileBytes = new Uint8Array([10, 20, 30]);
    mockFs.readFile.mockResolvedValue(fileBytes);

    const request = {
      nextUrl: new URL("http://localhost/api/admin/export/operation-123456?action=download"),
      headers: new Headers(),
    } as unknown as NextRequest;
    const response = await exportStatusGet(request, { params: Promise.resolve({ operationId: "operation-123456" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(mockFs.readFile).toHaveBeenCalledWith("/tmp/narravo-export-20240301-operation-1234.zip");
    const buffer = new Uint8Array(await response.arrayBuffer());
    expect(buffer).toEqual(fileBytes);
  });

  it("rejects restore requests missing files", async () => {
    const form = new FormData();
    const request = new Request("http://localhost/api/admin/restore", {
      method: "POST",
      body: form,
    });

    const response = await restorePost(request as unknown as NextRequest);
    const payload = await mockResponseJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: { message: "Backup file is required" } });
  });

  it("restores backups and returns summary", async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: "restore-log-1" }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    mockDb.insert.mockReturnValue({ values: insertValues });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set: updateSet });

    mockRestoreBackup.mockResolvedValue({
      tables: {
        posts: { toInsert: 2, toUpdate: 1 },
        comments: { toInsert: 0, toUpdate: 1 },
      },
    });

    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

    const buffer = new Uint8Array([1, 2, 3, 4]);
    const file = new File([buffer], "backup.zip", { type: "application/zip" });

    const form = new FormData();
    form.append("backupFile", file);
    form.append("dryRun", "false");
    form.append("skipUsers", "true");

    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      };
      await fn(tx);
    });

    const request = new Request("http://localhost/api/admin/restore", {
      method: "POST",
      body: form,
    });

    const response = await restorePost(request as unknown as NextRequest);
    const payload = await mockResponseJson(response);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.recordsAffected).toBe(4);
    expect(mockRestoreBackup).toHaveBeenCalledWith(expect.objectContaining({
      backupPath: expect.stringMatching(/\/tmp\/restore-operation-123456\.zip$/),
      skipUsers: true,
      dryRun: false,
    }));
    expect(mockFs.unlink).toHaveBeenCalled();
  });
});
