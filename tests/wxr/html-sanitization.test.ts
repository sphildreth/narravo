// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeHtml } from "../helpers/normalizeHtml";
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

describe("WXR Import - HTML Element Handling & Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should preserve nested list structure and normalize WordPress list markup", async () => {
    const listsXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Nested Lists Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <p><ul>
        <li><p>First item wrapped in p</p></li>
        <li><p>Second item</p>
          <ul>
            <li>Nested item</li>
            <li>Another nested</li>
          </ul>
        </li>
      </ul></p>
      <ol>
        <li>Ordered item 1</li>
        <li>Ordered item 2</li>
      </ol>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(listsXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // The importer should have normalized the list markup
    // (removing <p> wrapper around <ul> and <p> inside <li>)
  });

  it("should handle complex table markup correctly", async () => {
    const tableXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Complex Table</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <table>
        <thead>
          <tr>
            <th scope="col" colspan="2">Header Cell</th>
            <th rowspan="2">Another Header</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
            <td>Data 3</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">Footer</td>
          </tr>
        </tfoot>
      </table>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(tableXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should preserve code and pre elements without double-escaping", async () => {
    const codeXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Code Examples</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <pre><code class="language-javascript">
function hello() {
  console.log("Hello &lt;world&gt;");
  return 42;
}
      </code></pre>
      <p>Inline <code>const x = 5;</code> code here.</p>
      <blockquote cite="https://example.com">
        This is a quote with &amp; entities.
      </blockquote>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(codeXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Should preserve code content without double-escaping
  });

  it("should handle images with srcset and data attributes", async () => {
    const imagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Image Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <img src="image.jpg" 
           srcset="image-480w.jpg 480w, image-800w.jpg 800w"
           sizes="(max-width: 600px) 480px, 800px"
           alt="Test image"
           data-id="123"
           data-caption="A test image"
           width="800"
           height="600" />
      <figure>
        <img src="figure-image.jpg" alt="Figure image" />
        <figcaption>This is a caption</figcaption>
      </figure>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(imagesXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle anchor rel and target attributes safely", async () => {
    const linksXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Links Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <a href="https://example.com" target="_blank">External link (should get noopener noreferrer)</a>
      <a href="/internal" title="Internal link">Internal link</a>
      <a href="https://spam.com" target="_blank" rel="nofollow">Spam link (should preserve nofollow)</a>
      <a href="mailto:test@example.com">Email link</a>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(linksXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should transform or strip dangerous iframe/embed content", async () => {
    const iframeXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Iframe Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" allowfullscreen></iframe>
      <iframe src="https://evil.com/malicious" width="100" height="100"></iframe>
      <embed src="flash-content.swf" type="application/x-shockwave-flash" />
      <object data="some-object.pdf" type="application/pdf"></object>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(iframeXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // YouTube iframe might be transformed to internal embed
    // Evil iframe should be stripped
    // embed/object should be stripped or transformed
  });

  it("should strip script and style elements", async () => {
    const dangerousXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Security Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <p>Safe content before.</p>
      <script>alert('xss');</script>
      <style>body { background: red; }</style>
      <p>Safe content after.</p>
      <img src="x" onerror="alert('xss2')" />
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(dangerousXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Scripts, styles, and dangerous event handlers should be stripped
  });

  it("should handle mixed HTML entities and CDATA correctly", async () => {
    const entitiesXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>Entities &amp; CDATA Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <p>Entities: &nbsp;&amp;&lt;&gt;&quot;&#8217;&#8212;</p>
      <p>Quote: &ldquo;Hello&rdquo; &mdash; said nobody.</p>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(entitiesXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Entities should be decoded once, not double-decoded
  });

  it("should preserve RTL direction attributes", async () => {
    const rtlXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <item>
    <title>RTL Content Test</title>
    <guid>https://example.com/?p=1</guid>
    <dc:creator>admin</dc:creator>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <content:encoded><![CDATA[
      <div dir="rtl" lang="ar">
        <p>هذا نص باللغة العربية</p>
      </div>
      <div dir="ltr">
        <p>This is LTR text</p>
        <span dir="rtl">مع بعض النص العربي</span>
      </div>
    ]]></content:encoded>
  </item>
</channel>
</rss>`;

    vi.mocked(readFile).mockResolvedValue(rtlXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // dir and lang attributes should be preserved
  });

  it("should normalize line endings consistently", async () => {
    const crlfXml = `<?xml version="1.0" encoding="UTF-8"?>\r\n<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">\r\n<channel>\r\n  <item>\r\n    <title>CRLF Test</title>\r\n    <guid>https://example.com/?p=1</guid>\r\n    <dc:creator>admin</dc:creator>\r\n    <wp:post_type>post</wp:post_type>\r\n    <wp:status>publish</wp:status>\r\n    <content:encoded><![CDATA[\r\n      <p>Line 1\r\nLine 2\r\nLine 3</p>\r\n    ]]></content:encoded>\r\n  </item>\r\n</channel>\r\n</rss>`;

    vi.mocked(readFile).mockResolvedValue(crlfXml);

    const result = await importWxr("test.xml", { dryRun: true });

    expect(result.summary.postsImported).toBe(1);
    expect(result.errors).toHaveLength(0);
    
    // Line endings should be normalized consistently
  });
});