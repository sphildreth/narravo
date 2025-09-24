// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeHtml } from "../helpers/normalizeHtml";
import { importWxr } from "@/scripts/import-wxr";

// Mock dependencies
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

// Mock fs to load fixtures
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";

// Test fixtures embedded directly to avoid file loading issues in tests
const MINIMAL_WXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
    xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:wfw="http://wellformedweb.org/CommentAPI/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
    <title>WXR Test Blog</title>
    <link>https://example.com</link>
    <description>Fixture blog</description>
    <pubDate>Tue, 23 Sep 2025 12:00:00 +0000</pubDate>
    <language>en-US</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <wp:base_site_url>https://example.com</wp:base_site_url>
    <wp:base_blog_url>https://example.com</wp:base_blog_url>
<wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login><![CDATA[admin]]></wp:author_login>
    <wp:author_email>admin@example.com</wp:author_email>
    <wp:author_display_name><![CDATA[Admin]]></wp:author_display_name>
</wp:author>

<item>
    <title>Hello World</title>
    <link>https://example.com/hello-world</link>
    <pubDate>Tue, 23 Sep 2025 12:00:00 +0000</pubDate>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <guid isPermaLink="false">https://example.com/?p=1</guid>
    <description></description>
    <content:encoded><![CDATA[<p>First post content.</p>]]></content:encoded>
    <excerpt:encoded><![CDATA[First post content.]]></excerpt:encoded>
    <wp:post_id>1</wp:post_id>
    <wp:post_date>2025-09-23 12:00:00</wp:post_date>
    <wp:post_date_gmt>2025-09-23 12:00:00</wp:post_date_gmt>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>hello-world</wp:post_name>
    <category domain="category" nicename="general"><![CDATA[General]]></category>
    <wp:comment_status>open</wp:comment_status>
    <wp:ping_status>open</wp:ping_status>
    <wp:comment>
        <wp:comment_id>100</wp:comment_id>
        <wp:comment_author><![CDATA[Guest]]></wp:comment_author>
        <wp:comment_author_email>guest@example.com</wp:comment_author_email>
        <wp:comment_date>2025-09-23 13:00:00</wp:comment_date>
        <wp:comment_date_gmt>2025-09-23 13:00:00</wp:comment_date_gmt>
        <wp:comment_content><![CDATA[Welcome!]]></wp:comment_content>
        <wp:comment_approved>1</wp:comment_approved>
        <wp:comment_parent>0</wp:comment_parent>
    </wp:comment>
</item>
</channel>
</rss>`;

const MALFORMED_WXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <title>Broken</title>
    <item>
      <title>Oops</title>
      <wp:post_id>3</wp:post_id>
      <!-- Missing closing </item> tag makes this malformed -->
  </channel>
</rss>`;

const MORE_EXCERPT_WXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
    xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:wfw="http://wellformedweb.org/CommentAPI/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
    <title>WXR Test Blog</title>
    <link>https://example.com</link>
    <description>Fixture blog</description>
    <wp:wxr_version>1.2</wp:wxr_version>
<item>
    <title>More Split</title>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <guid isPermaLink="false">https://example.com/?p=50</guid>
    <wp:post_id>50</wp:post_id>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[Intro text<!--more-->Rest of the article]]></content:encoded>
    <excerpt:encoded><![CDATA[Explicit excerpt (should override)]]></excerpt:encoded>
    <wp:post_name>more-split</wp:post_name>
</item>
</channel>
</rss>`;

describe("WXR Import - Core Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse minimal WXR file correctly", async () => {
    vi.mocked(readFile).mockResolvedValue(MINIMAL_WXR);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.totalItems).toBeGreaterThan(0);
    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject malformed XML with clear error", async () => {
    vi.mocked(readFile).mockResolvedValue(MALFORMED_WXR);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.error).toMatch(/unexpected|close|tag|line/i);
  });

  it("should preserve UTF-8 encoding with emoji and accents", async () => {
    const unicodeXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Émojis and åccénts 🚀</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Testing émojis 🎉 and spéciål chåracters!</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(unicodeXml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle <!--more--> tags correctly", async () => {
    vi.mocked(readFile).mockResolvedValue(MORE_EXCERPT_WXR);

    const result = await importWxr("test.xml", { 
      dryRun: true, 
      verbose: true,
      rebuildExcerpts: true 
    });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle multiple <!--more--> tags correctly", async () => {
    const multipleMoreXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Multiple More Tags</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <p>This is the excerpt part.</p>
      <!--more-->
      <p>This is after the first more tag.</p>
      <!--more-->
      <p>This should remain as a more tag.</p>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(multipleMoreXml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});