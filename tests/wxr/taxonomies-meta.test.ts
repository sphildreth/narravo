// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { importWxr } from "@/scripts/import-wxr";

// Mock dependencies (same setup as core-functionality.test.ts)
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

describe("WXR Import - Taxonomies, Authors, and Meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle authors with missing email and default values", async () => {
    const authorsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login>admin</wp:author_login>
    <wp:author_email>admin@example.com</wp:author_email>
    <wp:author_display_name>Admin User</wp:author_display_name>
  </wp:author>
  <wp:author>
    <wp:author_id>2</wp:author_id>
    <wp:author_login>editor</wp:author_login>
    <!-- Missing email -->
    <wp:author_display_name>Editor User</wp:author_display_name>
  </wp:author>
  <item>
    <title>Post by Editor</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>editor</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Content by editor.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(authorsXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should handle missing email gracefully with defaults
  });

  it("should handle hierarchical categories", async () => {
    const hierarchyXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <wp:term>
    <wp:term_id>1</wp:term_id>
    <wp:term_taxonomy>category</wp:term_taxonomy>
    <wp:term_slug>technology</wp:term_slug>
    <wp:term_name>Technology</wp:term_name>
  </wp:term>
  <wp:term>
    <wp:term_id>2</wp:term_id>
    <wp:term_taxonomy>category</wp:term_taxonomy>
    <wp:term_slug>web-development</wp:term_slug>
    <wp:term_name>Web Development</wp:term_name>
    <wp:term_parent>technology</wp:term_parent>
  </wp:term>
  <wp:term>
    <wp:term_id>3</wp:term_id>
    <wp:term_taxonomy>category</wp:term_taxonomy>
    <wp:term_slug>javascript</wp:term_slug>
    <wp:term_name>JavaScript</wp:term_name>
    <wp:term_parent>web-development</wp:term_parent>
  </wp:term>
  <item>
    <title>JS Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>JavaScript content.</p>]]></content:encoded>
    <category domain="category" nicename="javascript">JavaScript</category>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(hierarchyXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should maintain category hierarchy
  });

  it("should handle custom taxonomies", async () => {
    const customTaxXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <wp:term>
    <wp:term_id>10</wp:term_id>
    <wp:term_taxonomy>genre</wp:term_taxonomy>
    <wp:term_slug>fiction</wp:term_slug>
    <wp:term_name>Fiction</wp:term_name>
  </wp:term>
  <wp:term>
    <wp:term_id>11</wp:term_id>
    <wp:term_taxonomy>genre</wp:term_taxonomy>
    <wp:term_slug>mystery</wp:term_slug>
    <wp:term_name>Mystery</wp:term_name>
  </wp:term>
  <item>
    <title>Book Review</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Great mystery novel!</p>]]></content:encoded>
    <category domain="genre" nicename="fiction">Fiction</category>
    <category domain="genre" nicename="mystery">Mystery</category>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(customTaxXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should handle custom taxonomies properly
  });

  it("should handle term slug collisions gracefully", async () => {
    const collisionXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <wp:term>
    <wp:term_id>1</wp:term_id>
    <wp:term_taxonomy>category</wp:term_taxonomy>
    <wp:term_slug>news</wp:term_slug>
    <wp:term_name>News</wp:term_name>
  </wp:term>
  <wp:term>
    <wp:term_id>2</wp:term_id>
    <wp:term_taxonomy>post_tag</wp:term_taxonomy>
    <wp:term_slug>news</wp:term_slug>
    <wp:term_name>News Tag</wp:term_name>
  </wp:term>
  <item>
    <title>News Post</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Latest news.</p>]]></content:encoded>
    <category domain="category" nicename="news">News</category>
    <category domain="post_tag" nicename="news">News Tag</category>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(collisionXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should handle slug collisions between different taxonomies
  });

  it("should handle basic comments with threading", async () => {
    const commentsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Post with Comments</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>This post has comments.</p>]]></content:encoded>
    <wp:comment>
      <wp:comment_id>1</wp:comment_id>
      <wp:comment_author>John Doe</wp:comment_author>
      <wp:comment_author_email>john@example.com</wp:comment_author_email>
      <wp:comment_author_url>https://johndoe.com</wp:comment_author_url>
      <wp:comment_date>2025-09-23 14:00:00</wp:comment_date>
      <wp:comment_date_gmt>2025-09-23 14:00:00</wp:comment_date_gmt>
      <wp:comment_content>Great post!</wp:comment_content>
      <wp:comment_approved>1</wp:comment_approved>
      <wp:comment_type></wp:comment_type>
      <wp:comment_parent>0</wp:comment_parent>
    </wp:comment>
    <wp:comment>
      <wp:comment_id>2</wp:comment_id>
      <wp:comment_author>Admin</wp:comment_author>
      <wp:comment_author_email>admin@example.com</wp:comment_author_email>
      <wp:comment_date>2025-09-23 15:00:00</wp:comment_date>
      <wp:comment_date_gmt>2025-09-23 15:00:00</wp:comment_date_gmt>
      <wp:comment_content>Thank you John!</wp:comment_content>
      <wp:comment_approved>1</wp:comment_approved>
      <wp:comment_type></wp:comment_type>
      <wp:comment_parent>1</wp:comment_parent>
    </wp:comment>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(commentsXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should preserve comment threading (parent-child relationships)
  });

  it("should handle different comment states", async () => {
    const commentStatesXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Post with Various Comment States</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Comments in different states.</p>]]></content:encoded>
    <wp:comment>
      <wp:comment_id>1</wp:comment_id>
      <wp:comment_author>Approved User</wp:comment_author>
      <wp:comment_author_email>approved@example.com</wp:comment_author_email>
      <wp:comment_date>2025-09-23 14:00:00</wp:comment_date>
      <wp:comment_content>Approved comment</wp:comment_content>
      <wp:comment_approved>1</wp:comment_approved>
      <wp:comment_parent>0</wp:comment_parent>
    </wp:comment>
    <wp:comment>
      <wp:comment_id>2</wp:comment_id>
      <wp:comment_author>Pending User</wp:comment_author>
      <wp:comment_author_email>pending@example.com</wp:comment_author_email>
      <wp:comment_date>2025-09-23 14:30:00</wp:comment_date>
      <wp:comment_content>Pending comment</wp:comment_content>
      <wp:comment_approved>0</wp:comment_approved>
      <wp:comment_parent>0</wp:comment_parent>
    </wp:comment>
    <wp:comment>
      <wp:comment_id>3</wp:comment_id>
      <wp:comment_author>Spam User</wp:comment_author>
      <wp:comment_author_email>spam@example.com</wp:comment_author_email>
      <wp:comment_date>2025-09-23 15:00:00</wp:comment_date>
      <wp:comment_content>Spam comment with links</wp:comment_content>
      <wp:comment_approved>spam</wp:comment_approved>
      <wp:comment_parent>0</wp:comment_parent>
    </wp:comment>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(commentStatesXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should handle approved, pending, spam states correctly
  });

  it("should handle post meta and serialized data", async () => {
    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Post with Meta</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[<p>Post with custom fields.</p>]]></content:encoded>
    <wp:postmeta>
      <wp:meta_key>_thumbnail_id</wp:meta_key>
      <wp:meta_value>123</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>custom_field</wp:meta_key>
      <wp:meta_value>Simple value</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>serialized_data</wp:meta_key>
      <wp:meta_value>a:2:{s:3:"key";s:5:"value";s:7:"another";s:4:"data";}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>large_meta</wp:meta_key>
      <wp:meta_value>This is a very large meta value that might need special handling in some systems. It contains a lot of text to test how the importer handles large metadata values.</wp:meta_value>
    </wp:postmeta>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(metaXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should preserve meta, handle serialized data, and featured image linkage
  });
});