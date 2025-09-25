import { describe, it, expect, vi, beforeEach } from "vitest";
import { importWxr, parseWxrItem } from "../../scripts/import-wxr";
import { loadFixture } from "../helpers/fixtures";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { parseStringPromise } from "xml2js";

// Mock dependencies with side-effects
vi.mock("@/lib/db", () => ({ db: { execute: vi.fn(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => []) })) })), transaction: vi.fn(async (callback) => await callback({ execute: vi.fn(), update: vi.fn(), insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(() => [{id: 'post-id-1'}]) })) })) })), delete: vi.fn() })) } }));
vi.mock("@/lib/s3", () => ({ getS3Config: vi.fn(), S3Service: vi.fn() }));
vi.mock("@/lib/local-storage", () => ({ localStorageService: { putObject: vi.fn(), getPublicUrl: vi.fn(), deletePrefix: vi.fn() } }));

describe("WXR: XML Parsing & Namespaces", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wxr-test-"));
  });

  async function writeTempFixture(name: string): Promise<string> {
    const content = loadFixture(name);
    const tempPath = path.join(tempDir, name);
    await fs.writeFile(tempPath, content);
    return tempPath;
  }

  it("parses a minimal, valid WXR file", async () => {
    const fixturePath = await writeTempFixture("wxr_minimal.xml");
    const result = await importWxr(fixturePath, { dryRun: true });

    expect(result.summary.totalItems).toBe(1);
    expect(result.summary.postsImported).toBe(1);
    expect(result.summary.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("parses a file with XML namespaces", async () => {
    const fixturePath = await writeTempFixture("wxr_namespaced.xml");
    const result = await importWxr(fixturePath, { dryRun: true, allowedStatuses: ["publish", "draft"] });

    expect(result.summary.totalItems).toBe(1);
    expect(result.summary.postsImported).toBe(1);
    expect(result.summary.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a malformed XML file with a clear error", async () => {
    const fixturePath = await writeTempFixture("wxr_malformed.xml");
    const result = await importWxr(fixturePath, { dryRun: true });

    expect(result.errors.length).toBeGreaterThan(0);
    const fatalError = result.errors.find(e => e.item === "FATAL");
    expect(fatalError).toBeDefined();
    expect(fatalError?.error).toContain("Unexpected close tag");
  });
});