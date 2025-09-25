// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { importWxr } from "@/scripts/import-wxr";
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

describe("WXR Import - Error Handling & Edge Cases", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wxr-test-"));
  });

  async function writeTestFile(name: string, content: string): Promise<string> {
    const tempPath = path.join(tempDir, name);
    await fs.writeFile(tempPath, content);
    return tempPath;
  }

  it("should handle empty files gracefully", async () => {
    const emptyFilePath = await writeTestFile("empty.xml", "");
    const result = await importWxr(emptyFilePath, { dryRun: true });
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.item).toBe("FATAL");
    expect(result.summary.postsImported).toBe(0);
  });

  it("should handle malformed XML gracefully", async () => {
    const malformedXml = `<?xml version="1.0"?><rss><channel><item><title>Test</item></channel></rss>`;
    const malformedPath = await writeTestFile("malformed.xml", malformedXml);
    
    const result = await importWxr(malformedPath, { dryRun: true });
    
    // Should fail gracefully with clear error
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.item).toBe("FATAL");
  });

  it("should handle missing required elements", async () => {
    const incompleteXml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
    <title>Test</title>
    <item>
        <title>Post without GUID or type</title>
    </item>
</channel>
</rss>`;
    const incompletePath = await writeTestFile("incomplete.xml", incompleteXml);
    
    const result = await importWxr(incompletePath, { dryRun: true });
    
    // Should skip items without required fields but not crash
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.postsImported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle very large content appropriately", async () => {
    const largeContent = "Large content ".repeat(10000); // ~140KB
    const largeXml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
    <title>Test</title>
    <item>
        <title>Large Post</title>
        <guid>https://example.com/?p=1</guid>
        <dc:creator>admin</dc:creator>
        <wp:post_type>post</wp:post_type>
        <wp:status>publish</wp:status>
        <content:encoded><![CDATA[${largeContent}]]></content:encoded>
    </item>
</channel>
</rss>`;
    
    const largePath = await writeTestFile("large.xml", largeXml);
    
    const startTime = Date.now();
    const result = await importWxr(largePath, { dryRun: true });
    const duration = Date.now() - startTime;
    
    // Should handle large content within reasonable time
    expect(duration).toBeLessThan(5000); // Less than 5 seconds
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle unicode and special characters correctly", async () => {
    const unicodeXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
    <title>Unicode Test</title>
    <item>
        <title>Unicode: 🌟 ñoño café naïve résumé</title>
        <guid>https://example.com/?p=1</guid>
        <dc:creator>admin</dc:creator>
        <wp:post_type>post</wp:post_type>
        <wp:status>publish</wp:status>
        <content:encoded><![CDATA[<p>Testing: 中文 العربية עברית русский 🚀🎉</p>]]></content:encoded>
    </item>
</channel>
</rss>`;
    
    const unicodePath = await writeTestFile("unicode.xml", unicodeXml);
    
    const result = await importWxr(unicodePath, { dryRun: true });
    
    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should provide actionable error messages", async () => {
    // Test invalid XML that should produce clear error messages
    const invalidXml = `<?xml version="1.0"?>
<rss version="2.0">
<channel>
    <title>Test</title>
    <item>
        <title>Invalid Item - Missing required fields</title>
        <description>No GUID or required fields</description>
    </item>
</channel>
</rss>`;
    
    const testPath = await writeTestFile("invalid.xml", invalidXml);
    const result = await importWxr(testPath, { dryRun: false });
    
    // Should handle missing required fields gracefully
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.postsImported).toBe(0);
    expect(result.errors).toHaveLength(0); // Not an error, just skipped
  });

  it("should handle invalid file paths", async () => {
    const result = await importWxr("/nonexistent/path/file.xml", { dryRun: true });
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.item).toBe("FATAL");
    expect(result.summary.postsImported).toBe(0);
  });

  it("should handle concurrent processing gracefully", async () => {
    const testXml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
    <title>Test</title>
    ${Array.from({ length: 10 }, (_, i) => `
    <item>
        <title>Post ${i + 1}</title>
        <guid>https://example.com/?p=${i + 1}</guid>
        <dc:creator>admin</dc:creator>
        <wp:post_type>post</wp:post_type>
        <wp:status>publish</wp:status>
        <content:encoded><![CDATA[<p>Content ${i + 1}</p>]]></content:encoded>
    </item>
    `).join('')}
</channel>
</rss>`;
    
    const concurrentPath = await writeTestFile("concurrent.xml", testXml);
    
    // Test with different concurrency settings
    const result1 = await importWxr(concurrentPath, { dryRun: true, concurrency: 1 });
    const result2 = await importWxr(concurrentPath, { dryRun: true, concurrency: 4 });
    
    // Both should produce the same results
    expect(result1.summary.postsImported).toBe(result2.summary.postsImported);
    expect(result1.summary.postsImported).toBe(10);
    expect(result1.errors).toHaveLength(0);
    expect(result2.errors).toHaveLength(0);
  });

  it("should handle network timeouts gracefully for media", async () => {
    const xmlWithMedia = `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
    <title>Test</title>
    <item>
        <title>Post with Media</title>
        <guid>https://example.com/?p=1</guid>
        <dc:creator>admin</dc:creator>
        <wp:post_type>post</wp:post_type>
        <wp:status>publish</wp:status>
        <content:encoded><![CDATA[<p>Content with <img src="https://unreachable-domain-12345.com/image.jpg" alt="Test"></p>]]></content:encoded>
    </item>
</channel>
</rss>`;
    
    const mediaPath = await writeTestFile("media.xml", xmlWithMedia);
    
    const result = await importWxr(mediaPath, { 
      dryRun: true, 
      skipMedia: false,
      allowedHosts: ["unreachable-domain-12345.com"]
    });
    
    // Should still import the post even if media fails
    expect(result.summary.postsImported).toBe(1);
    // Media failure shouldn't be a fatal error
  });
});