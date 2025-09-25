// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { importWxr } from "../scripts/import-wxr";

// Capture the last HTML passed to sanitizeHtml
let lastSanitizeInput: string | null = null;
vi.mock("@/lib/sanitize", () => ({
  sanitizeHtml: vi.fn((html: string) => {
    lastSanitizeInput = html;
    return html; // identity for test
  }),
}));

// Mock fs to emit a WXR containing an ordered list with attributes and <li><p> patterns
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Ordered List Post</title>
          <guid>https://example.com/?p=301</guid>
          <dc:creator>admin</dc:creator>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[
            <p>Intro</p>
            <p>
              <!-- wp:list -->
              <ol class="wp-block-list" start="3">
                <li><p>Third</p></li>
                <li><p>Fourth</p></li>
              </ol>
              <!-- /wp:list -->
            </p>
            <p>Outro</p>
          ]]></content:encoded>
        </item>
      </channel>
    </rss>`),
  writeFile: vi.fn(async () => {}),
}));

// Minimal DB mocks
vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(async () => ({ rows: [] })),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

// No S3 for this test
vi.mock("@/lib/s3", () => ({
  getS3Config: vi.fn(() => null),
  S3Service: vi.fn(),
}));

describe("WXR Import list normalization - ordered lists with attributes", () => {
  beforeEach(() => {
    lastSanitizeInput = null;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("preserves <ol> with attributes and unwraps <li><p>", async () => {
    await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(lastSanitizeInput).toBeTruthy();
    const html = String(lastSanitizeInput);

    // <p> wrapper removed around <ol> and comments tolerated
    expect(html).not.toMatch(/<p>\s*<!--[\s\S]*?-->\s*<ol/i);
    expect(html).not.toMatch(/<\/ol>\s*<!--[\s\S]*?-->\s*<\/p>/i);

    // Ordered list with attributes remains
    expect(html).toMatch(/<ol[^>]*class="wp-block-list"[^>]*>/i);

    // <li><p> unwrapped to <li>Text</li>
    expect(html).not.toMatch(/<li>\s*<p>/i);
    expect(html).not.toMatch(/<\/p>\s*<\/li>/i);
    expect(html).toMatch(/<li>Third<\/li>[\s\S]*<li>Fourth<\/li>/i);
  });
});
