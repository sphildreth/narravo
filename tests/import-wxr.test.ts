// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { db } from "@/lib/db";
import { posts, redirects, importJobs, importJobErrors } from "@/drizzle/schema";
import { importWxr, parseWxrItem, type WxrItem, type ImportResult } from "../scripts/import-wxr";

// Mock fs at the top level properly
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock all the DB operations as before
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock S3 service
vi.mock("@/lib/s3", () => ({
  getS3Config: vi.fn(() => null), // No S3 config for tests
  S3Service: vi.fn(),
}));

// Mock sanitizeHtml
vi.mock("@/lib/sanitize", () => ({
  sanitizeHtml: vi.fn((html: string) => html),
}));

// Import fs after mocking
import { readFile, writeFile } from "node:fs/promises";

describe("WXR Import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseWxrItem", () => {
    it("should parse a published post correctly", () => {
      const item: WxrItem = {
        title: "Test Post",
        link: "https://example.com/test-post/",
        "dc:creator": "admin",
        guid: "https://example.com/?p=1",
        "content:encoded": "<p>Test content</p>",
        "excerpt:encoded": "Test excerpt",
        "wp:post_id": "1",
        "wp:post_date": "2024-01-01 12:00:00",
        "wp:post_date_gmt": "2024-01-01 12:00:00",
        "wp:post_name": "test-post",
        "wp:status": "publish",
        "wp:post_type": "post",
        category: [
          {
            _: "Technology",
            "$": { domain: "category", nicename: "technology" }
          },
          {
            _: "JavaScript",
            "$": { domain: "post_tag", nicename: "javascript" }
          }
        ]
      };

      const result = parseWxrItem(item);

      expect(result).toEqual({
        type: "post",
        importedSystemId: "https://example.com/?p=1",
        title: "Test Post",
        slug: "test-post",
        html: "<p>Test content</p>",
        excerpt: "Test excerpt",
        author: "admin",
        publishedAt: new Date("2024-01-01 12:00:00"),
        originalUrl: "https://example.com/test-post/",
        featuredImageId: undefined,
        categories: [{ name: "Technology", slug: "technology" }],
        tags: [{ name: "JavaScript", slug: "javascript" }],
        comments: [],
      });
    });

    it("should parse an attachment correctly", () => {
      const item: WxrItem = {
        title: "Test Image",
        guid: "https://example.com/?attachment=4",
        "wp:post_type": "attachment",
        "wp:attachment_url": "https://example.com/wp-content/uploads/2024/01/test.jpg",
        "wp:postmeta": [
          {
            "wp:meta_key": "_wp_attachment_image_alt",
            "wp:meta_value": "Test image alt text"
          }
        ]
      };

      const result = parseWxrItem(item);

      expect(result).toEqual({
        importedSystemId: "https://example.com/?attachment=4",
        title: "Test Image",
        attachmentUrl: "https://example.com/wp-content/uploads/2024/01/test.jpg",
        alt: "Test image alt text",
        type: "attachment",
      });
    });

    it("should return null for items without GUID", () => {
      const item: WxrItem = {
        title: "Test Post",
        "wp:post_type": "post",
      };

      const result = parseWxrItem(item);
      expect(result).toBeNull();
    });

    it("should return null for non-post/non-attachment types", () => {
      const item: WxrItem = {
        title: "Test Page",
        guid: "https://example.com/?page=1",
        "wp:post_type": "page",
      };

      const result = parseWxrItem(item);
      expect(result).toBeNull();
    });

    it("should parse comments correctly", () => {
      const item: WxrItem = {
        title: "Test Post",
        guid: "https://example.com/?p=1",
        "wp:post_type": "post",
        "wp:status": "publish",
        "wp:comment": [
          {
            "wp:comment_id": "1",
            "wp:comment_author": "John Doe",
            "wp:comment_author_email": "john@example.com",
            "wp:comment_date": "2024-01-01 13:00:00",
            "wp:comment_date_gmt": "2024-01-01 13:00:00",
            "wp:comment_content": "Great post!",
            "wp:comment_approved": "1",
            "wp:comment_type": "",
            "wp:comment_parent": "0"
          }
        ]
      };

      const result = parseWxrItem(item);

      expect(result).toMatchObject({
        type: "post",
        comments: [
          {
            id: "1",
            author: "John Doe",
            authorEmail: "john@example.com",
            content: "Great post!",
            date: new Date("2024-01-01 13:00:00"),
            approved: true,
            parentId: undefined,
          }
        ]
      });
    });
  });

  describe("importWxr", () => {
    it("should parse sample WXR file and count items correctly", async () => {
      // Mock XML content
      const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
          <channel>
            <item>
              <title>Published Post</title>
              <guid>https://example.com/?p=1</guid>
              <dc:creator>admin</dc:creator>
              <wp:post_type>post</wp:post_type>
              <wp:status>publish</wp:status>
            </item>
            <item>
              <title>Draft Post</title>
              <guid>https://example.com/?p=2</guid>
              <dc:creator>admin</dc:creator>
              <wp:post_type>post</wp:post_type>
              <wp:status>draft</wp:status>
            </item>
            <item>
              <title>Test Image</title>
              <guid>https://example.com/?attachment=3</guid>
              <wp:post_type>attachment</wp:post_type>
              <wp:attachment_url>https://example.com/test.jpg</wp:attachment_url>
            </item>
          </channel>
        </rss>`;

      vi.mocked(readFile).mockResolvedValue(mockXmlContent);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      const result = await importWxr("test.xml", { dryRun: true, verbose: true });

      // Debug output to see what's actually parsed
      console.log("Import result:", result);

      expect(result.summary.totalItems).toBe(3);
      expect(result.summary.postsImported).toBe(1); // Only published posts
      expect(result.summary.attachmentsProcessed).toBe(1);
      expect(result.summary.skipped).toBe(1); // Draft post
      expect(result.dryRun).toBe(true);
    });

    it("should handle dry run mode", async () => {
      const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
          <channel>
            <item>
              <title>Test Post</title>
              <guid>https://example.com/?p=1</guid>
              <wp:post_type>post</wp:post_type>
              <wp:status>publish</wp:status>
            </item>
          </channel>
        </rss>`;

      vi.mocked(readFile).mockResolvedValue(mockXmlContent);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      const result = await importWxr("test.xml", { dryRun: true });

      expect(result.summary.totalItems).toBeGreaterThan(0);
      expect(result.summary.postsImported).toBeGreaterThan(0);
      expect(result.dryRun).toBe(true);
      
      // Should not call insert operations in dry run
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should detect when S3 is not configured", async () => {
      const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
          <channel>
            <item>
              <title>Test Image</title>
              <guid>https://example.com/?attachment=1</guid>
              <wp:post_type>attachment</wp:post_type>
              <wp:attachment_url>https://example.com/test.jpg</wp:attachment_url>
            </item>
          </channel>
        </rss>`;

      vi.mocked(readFile).mockResolvedValue(mockXmlContent);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      const result = await importWxr("test.xml", { dryRun: true, skipMedia: false });

      // Should process attachments even without S3 (just won't upload)
      expect(result.summary.attachmentsProcessed).toBe(1);
      expect(result.mediaUrls.size).toBe(0); // No successful uploads without S3
    });

    it("should filter posts by status", async () => {
      const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
          <channel>
            <item>
              <title>Published Post</title>
              <guid>https://example.com/?p=1</guid>
              <wp:post_type>post</wp:post_type>
              <wp:status>publish</wp:status>
            </item>
            <item>
              <title>Draft Post</title>
              <guid>https://example.com/?p=2</guid>
              <wp:post_type>post</wp:post_type>
              <wp:status>draft</wp:status>
            </item>
            <item>
              <title>Private Post</title>
              <guid>https://example.com/?p=3</guid>
              <wp:post_type>post</wp:post_type>
              <wp:status>private</wp:status>
            </item>
          </channel>
        </rss>`;

      vi.mocked(readFile).mockResolvedValue(mockXmlContent);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      // Test importing only drafts and private posts
      const result = await importWxr("test.xml", { 
        dryRun: true, 
        allowedStatuses: ["draft", "private"] 
      });

      expect(result.summary.totalItems).toBe(3);
      expect(result.summary.postsImported).toBe(2); // Draft + private
      expect(result.summary.skipped).toBe(1); // Published post skipped
    });

    it("should derive featured image from first image when no _thumbnail_id present", async () => {
      const insertedPosts: any[] = [];
      // Patch db.transaction mock implementation to also capture posts in onConflictDoUpdate chain
      // @ts-ignore
      db.transaction = vi.fn(async (fn: any) => {
        const tx = {
          insert: (_table: any) => ({
            values: (row: any) => ({
              onConflictDoUpdate: () => ({
                returning: () => {
                  // Capture post insertion (heuristic: presence of slug & html) even when conflict clause used
                  if (row.slug && row.html) {
                    insertedPosts.push(row);
                    return Promise.resolve([{ id: 'post1', ...row }]);
                  }
                  return Promise.resolve([{ id: row.guid ? 'user1' : 'gen', ...row }]);
                }
              }),
              onConflictDoNothing: () => Promise.resolve(),
              returning: () => {
                if (row.slug && row.html) {
                  insertedPosts.push(row);
                  return Promise.resolve([{ id: 'post1', ...row }]);
                }
                return Promise.resolve([{ id: row.guid ? 'user1' : 'gen', ...row }]);
              }
            })
          }),
          update: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
          select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })) })) })),
        };
        await fn(tx);
      });

      // XML with a single post containing an anchor-wrapped thumbnail image but no attachment meta
      const fullSize = 'https://example.com/wp-content/uploads/2017/07/20170723_175934.jpg';
      const thumb = 'https://example.com/wp-content/uploads/2017/07/20170723_175934-300x169.jpg';
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
          <channel>
            <item>
              <title>Fallback Featured Image Post</title>
              <guid>https://example.com/?p=99</guid>
              <wp:post_type>post</wp:post_type>
              <wp:status>publish</wp:status>
              <content:encoded><![CDATA[<p>Intro paragraph.</p><a href="${fullSize}" target="_blank" rel="noopener"><img class="aligncenter size-medium" src="${thumb}" alt="Concert photo" width="300" height="169" /></a><p>More text.</p>]]></content:encoded>
            </item>
          </channel>
        </rss>`;

      vi.mocked(readFile).mockResolvedValue(xml);
      vi.mocked(db.execute).mockResolvedValue({ rows: [] });

      const result = await importWxr('fallback.xml', { dryRun: false, skipMedia: true });

      expect(result.summary.postsImported).toBe(1);
      expect(insertedPosts.length).toBe(1);
      const inserted = insertedPosts[0];
      expect(inserted.featuredImageUrl).toBe(fullSize);
      expect(inserted.featuredImageAlt).toBe('Concert photo');
    });
  });
});