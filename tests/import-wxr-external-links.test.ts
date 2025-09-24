// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { importWxr } from "../scripts/import-wxr";

// Mock fs to return a simple WXR with one post containing external and media links
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Links Post</title>
          <guid>https://example.com/?p=200</guid>
          <dc:creator>admin</dc:creator>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[
            <p>External site: <a href="https://external.example.com/page">Visit</a></p>
            <p>Download report: <a href="https://files.example.com/report.pdf">PDF</a></p>
          ]]></content:encoded>
        </item>
      </channel>
    </rss>`),
  writeFile: vi.fn(async () => {}),
}));

// Mock database execute for existing slugs query
vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(async () => ({ rows: [] })),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

// Provide a mocked S3 service that records uploads
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

// Mock fetch to return different content types
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  let contentType = "application/octet-stream";
  let bytes = new Uint8Array([1, 2, 3]);
  if (url.endsWith(".pdf")) { contentType = "application/pdf"; bytes = new Uint8Array([5, 5, 5]); }
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
    arrayBuffer: async () => bytes.buffer,
  } as any;
});

describe("WXR Import external links handling", () => {
  beforeEach(() => {
    putCalls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("ignores non-media external <a href> links and only processes media/doc links", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["files.example.com"],
    });

    // Should only attempt to fetch the PDF, not the HTML page link
    expect(putCalls.length).toBe(1);

    // The media map should contain the PDF URL but not the external page URL
    expect(result.mediaUrls.has("https://files.example.com/report.pdf")).toBe(true);
    expect(result.mediaUrls.has("https://external.example.com/page")).toBe(false);
  });
});

