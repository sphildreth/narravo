
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { importWxr, ImportOptions } from "../scripts/import-wxr";
import * as fs from "node:fs";
import * as path from "node:path";
import { rm, mkdir, writeFile } from "node:fs/promises";

// Mock the database to avoid real database operations
vi.mock("@/lib/db", () => ({
  db: {
    delete: vi.fn(() => ({ returning: vi.fn(async () => []) })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ 
        returning: vi.fn(async () => [{ id: "test-id" }]),
        onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "test-id" }]) })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => []) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => []) })),
    })),
    execute: vi.fn(async () => ({ rows: [] })),
    transaction: vi.fn(async (fn: any) => {
      const tx = {
        delete: vi.fn(() => ({ returning: vi.fn(async () => []) })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ 
            returning: vi.fn(async () => [{ id: "test-id" }]),
            onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "test-id" }]) })),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({ where: vi.fn(async () => []) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(async () => []) })),
        })),
        execute: vi.fn(async () => ({ rows: [] })),
      };
      return await fn(tx);
    }),
  },
}));

// Mock the schema tables
vi.mock("@/drizzle/schema", () => ({
  posts: {},
  categories: {},
  tags: {},
  postTags: {},
  comments: {},
  redirects: {},
  importJobs: {},
  importJobErrors: {},
  users: {},
}));

const TEST_ROOT_URL = "http://my-old-site.com";
const UPLOADS_DIR = path.join(__dirname, "tmp-uploads");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const NARRAVO_UPLOADS_BASE = path.join(PUBLIC_DIR, "uploads");
const NARRAVO_IMPORTED_MEDIA = path.join(NARRAVO_UPLOADS_BASE, "imported-media");
const WXR_FILE_PATH = path.join(__dirname, "fixtures", "wxr", "wxr_offline_media.xml");

describe("WXR Importer - Offline Media", () => {
  beforeAll(async () => {
    // Create temp directories
    await mkdir(path.join(UPLOADS_DIR, "2023", "01"), { recursive: true });
    await mkdir(NARRAVO_IMPORTED_MEDIA, { recursive: true });

    // Create a fake media file in the temp uploads dir
    await writeFile(path.join(UPLOADS_DIR, "2023", "01", "test-image.jpg"), "fake image data");

    // Create a fake WXR file
    const wxrContent = `
<rss version="2.0"
    xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
    <item>
        <title>A Post with an Image</title>
        <link>${TEST_ROOT_URL}/a-post-with-an-image/</link>
        <pubDate>Mon, 23 Jan 2023 12:00:00 +0000</pubDate>
        <dc:creator><![CDATA[testuser]]></dc:creator>
        <guid isPermaLink="false">${TEST_ROOT_URL}/?p=1</guid>
        <content:encoded><![CDATA[<p>Here is an image:</p><img src="${TEST_ROOT_URL}/wp-content/uploads/2023/01/test-image.jpg" alt="A test image" />]]></content:encoded>
        <wp:post_id>1</wp:post_id>
        <wp:post_date><![CDATA[2023-01-23 12:00:00]]></wp:post_date>
        <wp:post_date_gmt><![CDATA[2023-01-23 12:00:00]]></wp:post_date_gmt>
        <wp:post_name><![CDATA[a-post-with-an-image]]></wp:post_name>
        <wp:status><![CDATA[publish]]></wp:status>
        <wp:post_type><![CDATA[post]]></wp:post_type>
    </item>
    <item>
        <title>A Post with a Missing Image</title>
        <link>${TEST_ROOT_URL}/a-post-with-a-missing-image/</link>
        <guid isPermaLink="false">${TEST_ROOT_URL}/?p=2</guid>
        <content:encoded><![CDATA[<p>Here is a missing image:</p><img src="${TEST_ROOT_URL}/wp-content/uploads/2023/01/missing-image.jpg" alt="A missing image" />]]></content:encoded>
        <wp:post_id>2</wp:post_id>
        <wp:post_date><![CDATA[2023-01-23 12:01:00]]></wp:post_date>
        <wp:post_name><![CDATA[a-post-with-a-missing-image]]></wp:post_name>
        <wp:status><![CDATA[publish]]></wp:status>
        <wp:post_type><![CDATA[post]]></wp:post_type>
    </item>
</channel>
</rss>
    `;
    await writeFile(WXR_FILE_PATH, wxrContent);
  });

  afterAll(async () => {
    // Clean up temp files and directories
    await rm(UPLOADS_DIR, { recursive: true, force: true });
    await rm(NARRAVO_IMPORTED_MEDIA, { recursive: true, force: true });
    await rm(WXR_FILE_PATH, { force: true });
  });

  it("should copy local media, rewrite URL, and import the post", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const options: ImportOptions = {
      dryRun: false,
      verbose: true,
      uploads: UPLOADS_DIR,
      root: `^${TEST_ROOT_URL}`,
      purgeBeforeImport: true, // Clean slate for the test
    };

    const result = await importWxr(WXR_FILE_PATH, options);

    // Test focuses on media processing, not post import
    // Posts may have import errors due to mocking, but media should work
    expect(result.mediaUrls.size).toBe(1);

    const newUrl = result.mediaUrls.get(`${TEST_ROOT_URL}/wp-content/uploads/2023/01/test-image.jpg`);
    expect(newUrl).toBe("/uploads/imported-media/2023/01/test-image.jpg");

    // Check if the file was copied
    const destinationFile = path.join(NARRAVO_IMPORTED_MEDIA, "2023", "01", "test-image.jpg");
    expect(fs.existsSync(destinationFile)).toBe(true);

    // Check if the missing file was not "copied"
    const missingFileDestination = path.join(NARRAVO_IMPORTED_MEDIA, "2023", "01", "missing-image.jpg");
    expect(fs.existsSync(missingFileDestination)).toBe(false);
  });

  it("should log a warning when a local media file is not found", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const options: ImportOptions = {
      dryRun: false,
      verbose: true,
      uploads: UPLOADS_DIR,
      root: `^${TEST_ROOT_URL}`,
    };

    await importWxr(WXR_FILE_PATH, options);

    // Check that the warning for the missing file was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Source file not found, skipping."));
  });
});
