// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { importWxr } from "../scripts/import-wxr";

let lastSanitizeInput: string | null = null;
vi.mock("@/lib/sanitize", () => ({
  sanitizeHtml: vi.fn((html: string) => {
    lastSanitizeInput = html;
    return html;
  }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Blockquote List Post</title>
          <guid>https://example.com/?p=303</guid>
          <dc:creator>admin</dc:creator>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[
            <blockquote>
              <p>
                <ul>
                  <li><p>Quoted item 1</p></li>
                  <li><p>Quoted item 2</p></li>
                </ul>
              </p>
            </blockquote>
          ]]></content:encoded>
        </item>
      </channel>
    </rss>`),
  writeFile: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(async () => ({ rows: [] })),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("@/lib/s3", () => ({
  getS3Config: vi.fn(() => null),
  S3Service: vi.fn(),
}));

describe("WXR Import list normalization - blockquote-wrapped lists", () => {
  beforeEach(() => { lastSanitizeInput = null; });
  afterEach(() => { vi.clearAllMocks(); });

  it("preserves lists inside blockquotes and unwraps inner <p>", async () => {
    await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(lastSanitizeInput).toBeTruthy();
    const html = String(lastSanitizeInput);

    // Ensure the list is not wrapped by paragraph inside blockquote
    expect(html).toMatch(/<blockquote>[\s\S]*<ul>[\s\S]*<li>Quoted item 1<\/li>[\s\S]*<li>Quoted item 2<\/li>[\s\S]*<\/ul>[\s\S]*<\/blockquote>/i);
    expect(html).not.toMatch(/<blockquote>[\s\S]*<p>\s*<ul/i);
  });
});
