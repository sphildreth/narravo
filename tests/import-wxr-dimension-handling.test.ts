// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { importWxr } from "../scripts/import-wxr";

// Test WXR content with WordPress dimensional images
const SAMPLE_WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title><![CDATA[WordPress Image Dimensions Test]]></title>
      <link>https://www.shildreth.com/test/wordpress-images</link>
      <pubDate>Sat, 16 Nov 2019 21:11:33 +0000</pubDate>
      <dc:creator><![CDATA[steven]]></dc:creator>
      <guid isPermaLink="false">https://www.shildreth.com/?p=100</guid>
      <content:encoded><![CDATA[
        <!-- Example from user request: image with explicit width/height and dimensioned URL -->
        <img class="aligncenter wp-image-419 size-medium" src="http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934-300x169.jpg" alt="" width="300" height="169" />
        
        <!-- Another dimensioned image without explicit dimensions -->
        <img src="https://www.shildreth.com/wp-content/uploads/2019/11/photo-501x1024.png" alt="Photo" class="wp-image-500" />
        
        <!-- Anchor link to dimensioned image -->
        <a href="https://www.shildreth.com/wp-content/uploads/2020/01/document-150x75.pdf">
          <img src="https://www.shildreth.com/wp-content/uploads/2020/01/document-150x75.pdf" alt="Document" />
        </a>
      ]]></content:encoded>
      <wp:post_id>100</wp:post_id>
      <wp:post_date><![CDATA[2019-11-16 16:11:33]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[2019-11-16 21:11:33]]></wp:post_date_gmt>
      <wp:post_name><![CDATA[wp-images-test]]></wp:post_name>
      <wp:status><![CDATA[publish]]></wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:post_type><![CDATA[post]]></wp:post_type>
    </item>
  </channel>
</rss>`;

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => SAMPLE_WXR),
  writeFile: vi.fn(async () => {}),
}));

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(async () => ({ rows: [] })),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(async (fn: any) => await fn({
      insert: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "user-1" }]) })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
    })),
  },
}));

// Track uploads
const putCalls: Array<{ key: string; contentType: string; size: number }> = [];
vi.mock("@/lib/s3", () => {
  class MockS3Service {
    bucket: string;
    endpoint?: string;
    constructor(config: any) {
      this.bucket = config.bucket;
      this.endpoint = config.endpoint;
    }
    async putObject(key: string, body: Uint8Array, contentType: string) {
      putCalls.push({ key, contentType, size: body.byteLength });
    }
    getPublicUrl(key: string) {
      return `https://storage.example.com/${this.bucket}/${key}`;
    }
  }
  return {
    getS3Config: vi.fn(() => ({
      region: "auto",
      endpoint: "https://storage.example.com",
      accessKeyId: "test",
      secretAccessKey: "test",
      bucket: "mock-bucket",
    })),
    S3Service: MockS3Service,
  };
});

// Mock fetch to return content for original (non-dimensioned) URLs only
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  // Original URLs without dimensions
  const originalUrls = [
    "http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934.jpg",
    "https://www.shildreth.com/wp-content/uploads/2019/11/photo.png",
    "https://www.shildreth.com/wp-content/uploads/2020/01/document.pdf"
  ];
  
  if (originalUrls.includes(url)) {
    const contentType = url.endsWith('.pdf') ? 'application/pdf' : 
                       url.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as any;
  }
  return {
    ok: false,
    status: 404,
    statusText: "Not Found",
    headers: { get: () => null },
    arrayBuffer: async () => new Uint8Array().buffer,
  } as any;
});

describe("WordPress Dimension URL Handling", () => {
  beforeEach(() => {
    putCalls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("removes WordPress dimension suffixes before downloading", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["www.shildreth.com"],
    });

    // Should download 3 original images (without dimensions)
    expect(putCalls.length).toBe(3);

    // Verify that fetch was called with original URLs, not dimensioned ones
    expect(fetchMock).toHaveBeenCalledWith("http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934.jpg", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("https://www.shildreth.com/wp-content/uploads/2019/11/photo.png", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("https://www.shildreth.com/wp-content/uploads/2020/01/document.pdf", expect.any(Object));

    // Verify that dimensioned URLs were NOT fetched
    expect(fetchMock).not.toHaveBeenCalledWith("http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934-300x169.jpg", expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith("https://www.shildreth.com/wp-content/uploads/2019/11/photo-501x1024.png", expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith("https://www.shildreth.com/wp-content/uploads/2020/01/document-150x75.pdf", expect.any(Object));
  });

  it("creates media mappings for original URLs", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["www.shildreth.com"],
    });

    // Verify mappings exist for original URLs
    expect(result.mediaUrls.has("http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934.jpg")).toBe(true);
    expect(result.mediaUrls.has("https://www.shildreth.com/wp-content/uploads/2019/11/photo.png")).toBe(true);
    expect(result.mediaUrls.has("https://www.shildreth.com/wp-content/uploads/2020/01/document.pdf")).toBe(true);

    // Verify mappings do not exist for dimensioned URLs
    expect(result.mediaUrls.has("http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934-300x169.jpg")).toBe(false);
    expect(result.mediaUrls.has("https://www.shildreth.com/wp-content/uploads/2019/11/photo-501x1024.png")).toBe(false);
    expect(result.mediaUrls.has("https://www.shildreth.com/wp-content/uploads/2020/01/document-150x75.pdf")).toBe(false);
  });
});