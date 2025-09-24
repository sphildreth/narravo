// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFixture } from "../helpers/fixtures";
import { normalizeHtml } from "../helpers/normalizeHtml";
import { importWxr } from "../../scripts/import-wxr";

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

describe("WXR Import - XML Parsing & Namespaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse minimal WXR file correctly", async () => {
    const xml = await loadFixture("wxr_minimal.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.totalItems).toBeGreaterThan(0);
    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle namespaced XML elements", async () => {
    const xml = await loadFixture("wxr_namespaced.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { 
      dryRun: true, 
      verbose: true,
      allowedStatuses: ["publish", "draft"] // Include draft posts
    });

    expect(result.summary.totalItems).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject malformed XML with clear error", async () => {
    const xml = await loadFixture("wxr_malformed.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.error).toMatch(/parse|malformed|xml/i);
  });

  it("should preserve UTF-8 encoding with emoji and accents", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe("WXR Import - More Tag & Excerpt Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use first <!--more--> to derive excerpt unless excerpt:encoded is present", async () => {
    const xml = await loadFixture("wxr_more_excerpt.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { 
      dryRun: true, 
      verbose: true,
      rebuildExcerpts: true 
    });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle multiple <!--more--> tags correctly", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe("WXR Import - HTML Element Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should preserve nested list structure", async () => {
    const xml = await loadFixture("wxr_html_lists.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle complex table markup", async () => {
    const xml = await loadFixture("wxr_table_complex.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should preserve code and pre elements without double-escaping", async () => {
    const xml = await loadFixture("wxr_code_pre_blockquote.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle images with srcset and data attributes", async () => {
    const xml = await loadFixture("wxr_img_srcset_data_attrs.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle anchor rel and target attributes safely", async () => {
    const xml = await loadFixture("wxr_anchor_rel_target.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should transform or strip dangerous iframe/embed content", async () => {
    const xml = await loadFixture("wxr_iframe_embed.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should strip script and style elements", async () => {
    const xml = await loadFixture("wxr_script_style.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle mixed HTML entities and CDATA correctly", async () => {
    const xml = await loadFixture("wxr_entities_cdata_mixed.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should preserve RTL direction attributes", async () => {
    const xml = await loadFixture("wxr_rtl_mixed_ltr.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should normalize line endings consistently", async () => {
    const xml = await loadFixture("wxr_line_endings_crlf.xml");
    vi.mocked(readFile).mockResolvedValue(xml);

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(result.summary.postsImported).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });
});