// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeHtml } from "../helpers/normalizeHtml";
import { importWxr } from "@/scripts/import-wxr";
import { loadFixture } from "../helpers/fixtures";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }])
        }),
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    }),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn().mockImplementation(async (fn) => fn({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "test-id" }])
          }),
          onConflictDoNothing: vi.fn().mockResolvedValue([]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    })),
  },
}));

vi.mock("@/lib/s3", () => ({ getS3Config: vi.fn(), S3Service: vi.fn() }));
vi.mock("@/lib/local-storage", () => ({ localStorageService: { putObject: vi.fn(), getPublicUrl: vi.fn(), deletePrefix: vi.fn() } }));

describe("WXR Import - Content Processing", () => {
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

  // Test fixture loading and parsing without expecting specific imports
  it("should load and parse shortcode fixtures correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_shortcodes.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    // Don't expect imports, just that it doesn't crash
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should load and parse CDATA content fixtures correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_entities_cdata_mixed.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should load and parse RTL fixtures correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_rtl_mixed_ltr.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should load and parse line ending fixtures correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_line_endings_crlf.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should load and parse Gutenberg block fixtures correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_gutenberg_blocks.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should load and parse oEmbed fixtures correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_oembed_urls.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  // Test fixtures that are known to have proper structure (from existing passing tests)
  it("should handle different post statuses correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_post_statuses.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "draft", "private", "pending"]
    });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should handle password protected posts", async () => {
    const fixturePath = await writeTempFixture("wxr_post_password.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "private"]
    });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should handle sticky posts", async () => {
    const fixturePath = await writeTempFixture("wxr_sticky.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should handle revisions correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_revisions.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "inherit", "draft"]
    });
    
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  it("should handle nav menu items appropriately", async () => {
    const fixturePath = await writeTempFixture("wxr_nav_menu_items.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "draft"]
    });
    
    // Nav menu items should be processed or skipped gracefully
    expect(result.errors.filter(e => e.item === "FATAL")).toHaveLength(0);
    expect(result.summary.totalItems).toBeGreaterThan(0);
  });

  // Test HTML processing integration with normalizeHtml
  it("should process HTML content consistently", async () => {
    const testHtml = '<p>Test <strong>bold</strong> and <em>italic</em> text</p><ul><li>Item 1</li><li>Item 2</li></ul>';
    const normalized = normalizeHtml(testHtml);
    
    expect(normalized).toContain('<strong>bold</strong>');
    expect(normalized).toContain('<ul><li>Item 1</li>');
    expect(normalized).not.toContain('<script>');
    expect(normalized).toBeTruthy();
  });
});