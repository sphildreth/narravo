// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { importWxr } from "../scripts/import-wxr";

// Mock fs to return a WXR with one published post containing a single <img> with the provided URL
const SAMPLE_WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title><![CDATA[Phonetic chart]]></title>
      <link>https://www.shildreth.com/2019/11/16/phonetic-chart/</link>
      <pubDate>Sat, 16 Nov 2019 21:11:33 +0000</pubDate>
      <dc:creator><![CDATA[steven]]></dc:creator>
      <guid isPermaLink="false">https://www.sphildreth.com/?p=467</guid>
      <content:encoded><![CDATA[
        <!-- wp:image {"id":468,"sizeSlug":"large"} -->
        <figure class="wp-block-image size-large"><img src="http://www.shildreth.com/wp-content/uploads/2019/11/800px-FAA_Phonetic_and_Morse_Chart2.svg_-501x1024.png" alt="" class="wp-image-468"/></figure>
        <!-- /wp:image -->
      ]]></content:encoded>
      <wp:post_id>467</wp:post_id>
      <wp:post_date><![CDATA[2019-11-16 16:11:33]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[2019-11-16 21:11:33]]></wp:post_date_gmt>
      <wp:post_name><![CDATA[phonetic-chart]]></wp:post_name>
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

// Mock database execute for existing slugs query and other no-op methods
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

// Mock fetch to return PNG bytes for the expected URL
const DIMENSIONED_IMAGE_URL = "http://www.shildreth.com/wp-content/uploads/2019/11/800px-FAA_Phonetic_and_Morse_Chart2.svg_-501x1024.png";
const ORIGINAL_IMAGE_URL = "http://www.shildreth.com/wp-content/uploads/2019/11/800px-FAA_Phonetic_and_Morse_Chart2.svg_.png";
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url === ORIGINAL_IMAGE_URL) {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "image/png" : null) },
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

describe("WXR Import single image handling", () => {
  beforeEach(() => {
    putCalls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("downloads the original image (without dimensions) and creates a media mapping", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["www.shildreth.com"],
    });

    // One image should be fetched and uploaded (the original URL, not the dimensioned one)
    expect(putCalls.length).toBe(1);

    // The mapping should be present for the original (non-dimensioned) URL
    expect(result.mediaUrls.has(ORIGINAL_IMAGE_URL)).toBe(true);
    const newUrl = result.mediaUrls.get(ORIGINAL_IMAGE_URL)!;
    expect(newUrl.startsWith("https://storage.example.com/mock-bucket/imported-media/")).toBe(true);
    
    // The fetch should have been called with the original URL, not the dimensioned one
    expect(fetchMock).toHaveBeenCalledWith(ORIGINAL_IMAGE_URL, expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith(DIMENSIONED_IMAGE_URL, expect.any(Object));
  });

  it("downloads image when allowedHosts includes scheme and path (normalization)", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["https://www.shildreth.com/some/path/"],
    });
    expect(putCalls.length).toBe(1);
    expect(result.mediaUrls.size).toBe(1);
  });

  it("skips image download when host not in allowlist", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["example.com"],
    });
    expect(putCalls.length).toBe(0);
    expect(result.mediaUrls.size).toBe(0);
  });

  it("allows subdomain when base domain is in allowlist", async () => {
    putCalls.length = 0;
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["shildreth.com"],
    });
    expect(putCalls.length).toBe(1);
    expect(result.mediaUrls.size).toBe(1);
  });
  
  it("replaces dimensioned URLs with local URLs and preserves/adds width/height attributes", async () => {
    // Create a mock with explicit width/height attributes
    const wxrWithDimensions = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title><![CDATA[Test Image with Dimensions]]></title>
      <link>https://example.com/test</link>
      <pubDate>Sat, 16 Nov 2019 21:11:33 +0000</pubDate>
      <dc:creator><![CDATA[steven]]></dc:creator>
      <guid isPermaLink="false">https://example.com/?p=123</guid>
      <content:encoded><![CDATA[
        <img class="aligncenter wp-image-419 size-medium" src="http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934-300x169.jpg" alt="" width="300" height="169" />
        <img src="http://www.shildreth.com/wp-content/uploads/2017/07/another-image-150x100.png" alt="Another image" />
      ]]></content:encoded>
      <wp:post_id>123</wp:post_id>
      <wp:post_date><![CDATA[2019-11-16 16:11:33]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[2019-11-16 21:11:33]]></wp:post_date_gmt>
      <wp:post_name><![CDATA[test-image]]></wp:post_name>
      <wp:status><![CDATA[publish]]></wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:post_type><![CDATA[post]]></wp:post_type>
    </item>
  </channel>
</rss>`;

    // Mock multiple original URLs
    const fetchMockMultiple = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934.jpg" ||
          url === "http://www.shildreth.com/wp-content/uploads/2017/07/another-image.png") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
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

    // Mock readFile to return our test content
    const mockReadFile = vi.mocked(await import("node:fs/promises")).readFile;
    mockReadFile.mockResolvedValueOnce(wxrWithDimensions);
    
    vi.stubGlobal("fetch", fetchMockMultiple);
    putCalls.length = 0;

    const result = await importWxr("test-dimensions.xml", {
      dryRun: false,
      verbose: true,
      allowedHosts: ["www.shildreth.com"],
    });

    // Should download 2 original images
    expect(putCalls.length).toBe(2);
    
    // Should have mappings for both original URLs
    expect(result.mediaUrls.has("http://www.shildreth.com/wp-content/uploads/2017/07/20170723_175934.jpg")).toBe(true);
    expect(result.mediaUrls.has("http://www.shildreth.com/wp-content/uploads/2017/07/another-image.png")).toBe(true);
    
    vi.unstubAllGlobals();
    fetchMockMultiple.mockClear();
  });
});
