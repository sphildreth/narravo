// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { posts, redirects } from "@/drizzle/schema";
import { importWxr, parseWxrItem, type WxrItem, type ImportResult } from "../scripts/import-wxr";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

// Mock S3 service
vi.mock("@/lib/s3", () => ({
  getS3Config: vi.fn(() => null), // No S3 config for tests
  S3Service: vi.fn(),
}));

// Mock fs
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual("node:fs/promises");
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock global fetch
global.fetch = vi.fn();

describe("WXR Importer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseWxrItem", () => {
    it("should parse a basic post item", () => {
      const item: WxrItem = {
        title: "Test Post",
        guid: "https://example.com/?p=1",
        link: "https://example.com/2024/01/test-post/",
        "content:encoded": "<p>Test content</p>",
        "excerpt:encoded": "Test excerpt",
        "wp:post_date_gmt": "2024-01-01 12:00:00",
        "wp:post_name": "test-post",
        "wp:status": "publish",
        "wp:post_type": "post",
      };

      const result = parseWxrItem(item);

      expect(result).toEqual({
        guid: "https://example.com/?p=1",
        title: "Test Post",
        slug: "test-post",
        html: "<p>Test content</p>",
        excerpt: "Test excerpt",
        publishedAt: new Date("2024-01-01T12:00:00Z"),
        originalUrl: "https://example.com/2024/01/test-post/",
        status: "publish",
        postType: "post",
      });
    });

    it("should handle missing optional fields", () => {
      const item: WxrItem = {
        title: "Simple Post",
        guid: "https://example.com/?p=2",
        "wp:post_type": "post",
        "wp:status": "publish",
      };

      const result = parseWxrItem(item);

      expect(result).toMatchObject({
        title: "Simple Post",
        guid: "https://example.com/?p=2",
        html: "",
        excerpt: null,
        publishedAt: null,
      });
    });

    it("should skip non-post items", () => {
      const item: WxrItem = {
        title: "Test Page",
        guid: "https://example.com/?page_id=1",
        "wp:post_type": "page",
        "wp:status": "publish",
      };

      const result = parseWxrItem(item);

      expect(result).toBeNull();
    });

    it("should skip draft posts", () => {
      const item: WxrItem = {
        title: "Draft Post",
        guid: "https://example.com/?p=3",
        "wp:post_type": "post",
        "wp:status": "draft",
      };

      const result = parseWxrItem(item);

      expect(result).toBeNull();
    });

    it("should handle attachment items", () => {
      const item: WxrItem = {
        title: "Test Image",
        guid: "https://example.com/?attachment=4",
        "wp:post_type": "attachment",
        "wp:status": "inherit",
        "wp:attachment_url": "https://example.com/wp-content/uploads/2024/01/test.jpg",
      };

      const result = parseWxrItem(item);

      expect(result).toEqual({
        guid: "https://example.com/?attachment=4",
        title: "Test Image",
        attachmentUrl: "https://example.com/wp-content/uploads/2024/01/test.jpg",
        type: "attachment",
      });
    });
  });

  describe("importWxr", () => {
    it("should parse sample WXR file and count items correctly", async () => {
      const fixturePath = path.join(process.cwd(), "tests/fixtures/sample.wxr");
      const result = await importWxr(fixturePath, { dryRun: true });

      // Our sample file has 4 items total: 3 posts (2 published, 1 draft) + 1 attachment
      expect(result.summary.totalItems).toBe(4);
      expect(result.summary.postsImported).toBe(2); // Only published posts
      expect(result.summary.attachmentsProcessed).toBe(1);
      expect(result.summary.skipped).toBe(1); // Draft post
      expect(result.dryRun).toBe(true);
    });

    it("should handle dry run mode", async () => {
      const fixturePath = path.join(process.cwd(), "tests/fixtures/sample.wxr");
      const result = await importWxr(fixturePath, { dryRun: true });

      expect(result.summary.totalItems).toBeGreaterThan(0);
      expect(result.summary.postsImported).toBeGreaterThan(0);
      expect(result.dryRun).toBe(true);
    });

    it("should detect when S3 is not configured", async () => {
      const fixturePath = path.join(process.cwd(), "tests/fixtures/sample.wxr");
      const result = await importWxr(fixturePath, { dryRun: true, skipMedia: false });

      // Should process attachments even without S3 (just won't upload)
      expect(result.summary.attachmentsProcessed).toBe(1);
      expect(result.mediaUrls.size).toBe(0); // No successful uploads without S3
    });
  });
});