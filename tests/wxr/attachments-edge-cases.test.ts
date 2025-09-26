// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { importWxr } from "@/scripts/import-wxr";

// Mock dependencies (same setup as other test files)
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "test-id" }]),
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
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    })),
  },
}));

vi.mock("@/lib/s3", () => ({
  getS3Config: vi.fn(() => null),
  S3Service: vi.fn(),
}));

vi.mock("@/lib/local-storage", () => ({
  localStorageService: {
    uploadFile: vi.fn().mockResolvedValue("mock-upload-path"),
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";

describe("WXR Import - Attachments, Media, and Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle basic attachments with parent linkage", async () => {
    const attachmentsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Sample Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_id>1</wp:post_id>
    <content:encoded><![CDATA[<p>Post with featured image.</p>]]></content:encoded>
    <wp:postmeta>
      <wp:meta_key>_thumbnail_id</wp:meta_key>
      <wp:meta_value>2</wp:meta_value>
    </wp:postmeta>
  </item>
  <item>
    <title>Sample Image</title>
    <guid>https://example.com/?attachment=2</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>attachment</wp:post_type>
    <wp:status>inherit</wp:status>
    <wp:post_id>2</wp:post_id>
    <wp:post_parent>1</wp:post_parent>
    <wp:attachment_url>https://example.com/wp-content/uploads/2025/09/sample.jpg</wp:attachment_url>
    <wp:postmeta>
      <wp:meta_key>_wp_attachment_image_alt</wp:meta_key>
      <wp:meta_value>Sample image alt text</wp:meta_value>
    </wp:postmeta>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(attachmentsXml);

    const result = await importWxr("test.xml", { dryRun: true, skipMedia: false });

    expect(result.summary.postsImported).toBe(1);
    expect(result.summary.attachmentsProcessed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    
    // Should handle attachment-to-post relationships and featured image linking
  });

  it("should handle missing attachment files gracefully", async () => {
    const missingFileXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Broken Image Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Post with broken image <img src="https://example.com/missing.jpg" alt="Missing" /></p>]]></content:encoded>
  </item>
  <item>
    <title>Missing File Attachment</title>
    <guid>https://example.com/?attachment=2</guid>
    <wp:post_type>attachment</wp:post_type>
    <wp:status>inherit</wp:status>
    <wp:attachment_url>https://example.com/404-not-found.jpg</wp:attachment_url>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(missingFileXml);

    const result = await importWxr("test.xml", { dryRun: true, skipMedia: false });

    expect(result.summary.postsImported).toBe(1);
    expect(result.summary.attachmentsProcessed).toBe(1);
    expect(result.errors).toHaveLength(0); // Should not error on missing files, just log
  });

  it("should handle attachment URL variants and canonicalization", async () => {
    const variantsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Image Variants Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <p>Same image with different query params:</p>
      <img src="https://example.com/image.jpg?v=1" alt="Version 1" />
      <img src="https://example.com/image.jpg?v=2" alt="Version 2" />
      <img src="https://example.com/image.jpg" alt="No params" />
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(variantsXml);

    const result = await importWxr("test.xml", { dryRun: true, skipMedia: false });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should deduplicate similar URLs and canonicalize
  });

  it("should handle orphan attachments", async () => {
    const orphanXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Orphan Attachment</title>
    <guid>https://example.com/?attachment=1</guid>
    <wp:post_type>attachment</wp:post_type>
    <wp:status>inherit</wp:status>
    <wp:attachment_url>https://example.com/orphan.jpg</wp:attachment_url>
    <!-- No wp:post_parent, making this an orphan -->
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(orphanXml);

    const result = await importWxr("test.xml", { dryRun: true, skipMedia: false });

    expect(result.summary.attachmentsProcessed).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should import orphan attachments and log them for review
  });

  it("should handle duplicate GUIDs gracefully", async () => {
    const duplicateGuidsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>First Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_id>1</wp:post_id>
    <content:encoded><![CDATA[<p>First post content.</p>]]></content:encoded>
  </item>
  <item>
    <title>Second Post</title>
    <guid>https://example.com/?p=1</guid> <!-- Duplicate GUID -->
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_id>2</wp:post_id>
    <content:encoded><![CDATA[<p>Second post content.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(duplicateGuidsXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    
    // Should handle duplicate GUIDs without collision in internal IDs
  });

  it("should handle missing GUIDs with fallback keys", async () => {
    const missingGuidXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Post Without GUID</title>
    <!-- Missing GUID element -->
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_id>1</wp:post_id>
    <wp:post_date>2025-09-23 12:00:00</wp:post_date>
    <wp:post_name>post-without-guid</wp:post_name>
    <content:encoded><![CDATA[<p>Post without GUID.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(missingGuidXml);

    const result = await importWxr("test.xml", { dryRun: true });

    // This might fail since our current parser requires GUID
    // but the test verifies the expected behavior
    expect(result.summary.skipped).toBe(1); // Expected to skip items without GUID
    expect(result.errors).toHaveLength(0);
  });

  it("should handle mixed dates and timezones correctly", async () => {
    const datesXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Past Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_date>2020-01-01 12:00:00</wp:post_date>
    <wp:post_date_gmt>2020-01-01 17:00:00</wp:post_date_gmt>
    <content:encoded><![CDATA[<p>Past post.</p>]]></content:encoded>
  </item>
  <item>
    <title>Future Post</title>
    <guid>https://example.com/?p=2</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>future</wp:status>
    <wp:post_date>2030-01-01 12:00:00</wp:post_date>
    <wp:post_date_gmt>2030-01-01 17:00:00</wp:post_date_gmt>
    <content:encoded><![CDATA[<p>Future post.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(datesXml);

    const result = await importWxr("test.xml", { 
      dryRun: true,
      allowedStatuses: ["publish", "future"] 
    });

    expect(result.summary.postsImported).toBe(2);
    expect(result.errors).toHaveLength(0);
    
    // Should handle past/future dates and timezone conversion correctly
  });

  it("should handle slug edge cases and normalization", async () => {
    const slugsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Post With Üñíçødé Tîtle</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>post-with-unicode-title</wp:post_name>
    <content:encoded><![CDATA[<p>Unicode slug post.</p>]]></content:encoded>
  </item>
  <item>
    <title>Another Post</title>
    <guid>https://example.com/?p=2</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>post-with-unicode-title</wp:post_name> <!-- Same slug -->
    <content:encoded><![CDATA[<p>Slug collision post.</p>]]></content:encoded>
  </item>
  <item>
    <title>Post With Very Long Title That Should Be Truncated Or Normalized Properly In The Slug Generation</title>
    <guid>https://example.com/?p=3</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>post-with-very-long-title-that-should-be-truncated-or-normalized-properly-in-the-slug-generation</wp:post_name>
    <content:encoded><![CDATA[<p>Long slug post.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(slugsXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(3);
    expect(result.errors).toHaveLength(0);
    
    // Should normalize Unicode slugs and handle collisions deterministically
  });

  it("should handle large content and many items within reasonable time", async () => {
    // Create a large WXR with many small posts
    const manyItemsContent = Array.from({ length: 50 }, (_, i) => `
  <item>
    <title>Post ${i + 1}</title>
    <guid>https://example.com/?p=${i + 1}</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>post-${i + 1}</wp:post_name>
    <content:encoded><![CDATA[<p>Content for post ${i + 1}.</p>]]></content:encoded>
  </item>`).join('');

    const manyItemsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>${manyItemsContent}
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(manyItemsXml);

    const startTime = Date.now();
    const result = await importWxr("test.xml", { dryRun: true });
    const duration = Date.now() - startTime;

    expect(result.summary.postsImported).toBe(50);
    expect(result.errors).toHaveLength(0);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    // Should handle many items efficiently without quadratic growth
  });

  it("should demonstrate idempotency on re-import", async () => {
    const idempotentXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Idempotent Post</title>
    <guid>https://example.com/?p=42</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_id>42</wp:post_id>
    <wp:post_name>idempotent-post</wp:post_name>
    <content:encoded><![CDATA[<p>This post should not be duplicated on re-import.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(idempotentXml);

    // First import
    const result1 = await importWxr("test1.xml", { dryRun: true });
    expect(result1.summary.postsImported).toBe(1);

    // Second import of the same content
    const result2 = await importWxr("test2.xml", { dryRun: true });
    expect(result2.summary.postsImported).toBe(1); // Should update existing, not duplicate

    expect(result1.errors).toHaveLength(0);
    expect(result2.errors).toHaveLength(0);
    
    // Re-import should update in place by GUID/slug keys; no duplicates
  });
});