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

// Mock fs to emit a WXR containing list markup wrapped in <p> and <li><p> patterns
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>List Post</title>
          <guid>https://example.com/?p=300</guid>
          <dc:creator>admin</dc:creator>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[
            <p>Intro paragraph.</p>
            <p>
              <ul>
                <li><p>First item</p></li>
                <li><p>Second item</p></li>
              </ul>
            </p>
            <p>Outro paragraph.</p>
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

describe("WXR Import list normalization", () => {
  beforeEach(() => {
    lastSanitizeInput = null;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes <p>-wrapped lists and <li><p> to valid list markup before sanitization", async () => {
    await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(lastSanitizeInput).toBeTruthy();
    const html = String(lastSanitizeInput);

    // <p> wrapper removed around <ul>
    expect(html).not.toMatch(/<p>\s*<ul/i);
    expect(html).not.toMatch(/<\/ul>\s*<\/p>/i);

    // <li><p> unwrapped to <li>Text</li>
    expect(html).not.toMatch(/<li>\s*<p>/i);
    expect(html).not.toMatch(/<\/p>\s*<\/li>/i);

    // Ensure list items are present and intact
    expect(html).toMatch(/<ul>[\s\S]*<li>First item<\/li>[\s\S]*<li>Second item<\/li>[\s\S]*<\/ul>/i);

    // Ensure paragraphs around lists remain where appropriate
    expect(html).toMatch(/<p>Intro paragraph\.<\/p>/i);
    expect(html).toMatch(/<p>Outro paragraph\.<\/p>/i);
  });
});

