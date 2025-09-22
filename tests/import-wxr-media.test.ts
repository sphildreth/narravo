// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { importWxr } from "../scripts/import-wxr";

// Mock fs to return a simple WXR with one post containing media URLs in HTML
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Media Post</title>
          <guid>https://example.com/?p=100</guid>
          <dc:creator>admin</dc:creator>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[
            <p>Image: <img src="https://media.example.com/images/foo.jpg" srcset="https://media.example.com/images/foo@2x.jpg 2x, https://media.example.com/images/foo@1x.jpg 1x" /></p>
            <video controls poster="https://media.example.com/videos/poster.png">
              <source src="https://media.example.com/videos/video.webm" type="video/webm" />
              <source src="https://media.example.com/videos/video.mp4" type="video/mp4" />
            </video>
            <a href="https://media.example.com/files/sample.pdf">Download</a>
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

// Mock fetch to return different content types for different URLs
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  let contentType = "application/octet-stream";
  let bytes = new Uint8Array([1, 2, 3]);
  if (url.endsWith(".jpg")) { contentType = "image/jpeg"; bytes = new Uint8Array([9, 9, 9]); }
  if (url.endsWith(".png")) { contentType = "image/png"; bytes = new Uint8Array([8, 8, 8]); }
  if (url.endsWith(".webm")) { contentType = "video/webm"; bytes = new Uint8Array([7, 7, 7]); }
  if (url.endsWith(".mp4")) { contentType = "video/mp4"; bytes = new Uint8Array([6, 6, 6]); }
  if (url.endsWith(".pdf")) { contentType = "application/pdf"; bytes = new Uint8Array([5, 5, 5]); }
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
    arrayBuffer: async () => bytes.buffer,
  } as any;
});

describe("WXR Import media fetching", () => {
  beforeEach(() => {
    putCalls.length = 0;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("downloads and maps remote media URLs referenced in post HTML", async () => {
    const result = await importWxr("test.xml", {
      dryRun: true,
      verbose: true,
      allowedHosts: ["media.example.com"],
    });

    // Expect that we attempted to fetch media for img/src, srcset (two), poster, and two <source> URLs, and the PDF link
    // Total URLs: foo.jpg, foo@2x.jpg, foo@1x.jpg, poster.png, video.webm, video.mp4, sample.pdf => 7
    expect(putCalls.length).toBe(7);

    // The result should have a mapping for each remote URL to a storage URL
    expect(result.mediaUrls.size).toBe(7);
    for (const [oldUrl, newUrl] of result.mediaUrls) {
      expect(oldUrl.startsWith("http")).toBe(true);
      expect(newUrl.startsWith("https://storage.example.com/mock-bucket/imported-media/")).toBe(true);
    }
  });
});

