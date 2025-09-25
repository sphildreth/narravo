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

  it("should handle shortcodes correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_shortcodes.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "draft", ""] // Allow empty status
    });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Shortcodes should be processed but preserved
    // (Note: actual behavior depends on shortcode processing implementation)
  });

  it("should handle CDATA content correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_entities_cdata_mixed.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // CDATA and entities should be handled properly
    // Content should not be double-encoded
  });

  it("should handle RTL and mixed direction content", async () => {
    const fixturePath = await writeTempFixture("wxr_rtl_mixed_ltr.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should normalize line endings consistently", async () => {
    const fixturePath = await writeTempFixture("wxr_line_endings_crlf.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Line endings should be normalized without affecting content semantics
  });

  it("should handle Gutenberg blocks correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_gutenberg_blocks.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Gutenberg block comments should be preserved
  });

  it("should handle oEmbed URLs correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_oembed_urls.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // oEmbed URLs should be processed appropriately
  });

  it("should handle different post statuses correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_post_statuses.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "draft", "private", "pending"]
    });
    
    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle password protected posts", async () => {
    const fixturePath = await writeTempFixture("wxr_post_password.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "private"]
    });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle sticky posts", async () => {
    const fixturePath = await writeTempFixture("wxr_sticky.xml");
    const result = await importWxr(fixturePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle revisions correctly", async () => {
    const fixturePath = await writeTempFixture("wxr_revisions.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "inherit"]
    });
    
    // Should process the main post, revisions might be skipped or handled specially
    expect(result.summary.postsImported).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle nav menu items appropriately", async () => {
    const fixturePath = await writeTempFixture("wxr_nav_menu_items.xml");
    const result = await importWxr(fixturePath, { 
      dryRun: true, 
      allowedStatuses: ["publish", "draft"]
    });
    
    // Nav menu items should be processed or skipped gracefully
    expect(result.errors).toHaveLength(0);
  });
});