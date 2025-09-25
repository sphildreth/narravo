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
          <title>Nested List Post</title>
          <guid>https://example.com/?p=302</guid>
          <dc:creator>admin</dc:creator>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[
            <p>Intro</p>
            <p>
              <ul>
                <li>Parent 1
                  <ul>
                    <li><p>Child 1.1</p></li>
                    <li><p>Child 1.2</p></li>
                  </ul>
                </li>
                <li>Parent 2</li>
              </ul>
            </p>
            <p>Outro</p>
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

describe("WXR Import list normalization - nested lists", () => {
  beforeEach(() => { lastSanitizeInput = null; });
  afterEach(() => { vi.clearAllMocks(); });

  it("preserves nested <ul> structure and unwraps inner <p>", async () => {
    await importWxr("test.xml", { dryRun: true, verbose: true });

    expect(lastSanitizeInput).toBeTruthy();
    const html = String(lastSanitizeInput);

    // Wrapper <p> is removed
    expect(html).not.toMatch(/<p>\s*<ul/i);
    expect(html).not.toMatch(/<\/ul>\s*<\/p>/i);

    // Nested structure remains and inner <p> unwrapped
    expect(html).toMatch(/<ul>[\s\S]*<li>Parent 1[\s\S]*<ul>[\s\S]*<li>Child 1\.1<\/li>[\s\S]*<li>Child 1\.2<\/li>[\s\S]*<\/ul>[\s\S]*<\/li>[\s\S]*<li>Parent 2<\/li>[\s\S]*<\/ul>/i);
  });
});
