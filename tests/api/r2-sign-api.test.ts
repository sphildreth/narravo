// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as r2SignPost } from "@/app/api/r2/sign/route";

const mockConfigInstance = {
  getNumber: vi.fn(),
  getJSON: vi.fn(),
};
const ConfigServiceImpl = vi.fn(() => mockConfigInstance);

const mockLocalStorage = {
  getPublicUrl: vi.fn(),
};

const mockS3ServicePrototype = {
  createPresignedPost: vi.fn(),
  getPublicUrl: vi.fn(),
};

const mockGetS3Config = vi.fn();

vi.mock("@/lib/config", () => ({
  get ConfigServiceImpl() {
    return ConfigServiceImpl;
  },
}));

vi.mock("@/lib/local-storage", () => ({
  get localStorageService() {
    return mockLocalStorage;
  },
}));

vi.mock("@/lib/s3", () => ({
  getS3Config: (...args: unknown[]) => mockGetS3Config(...args),
  S3Service: vi.fn(() => mockS3ServicePrototype),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("/api/r2/sign", () => {
  beforeEach(() => {
    ConfigServiceImpl.mockClear();
    mockConfigInstance.getNumber.mockReset();
    mockConfigInstance.getJSON.mockReset();
    mockLocalStorage.getPublicUrl.mockReset();
    mockS3ServicePrototype.createPresignedPost.mockReset();
    mockS3ServicePrototype.getPublicUrl.mockReset();
    mockGetS3Config.mockReset();

    mockConfigInstance.getNumber.mockImplementation((key: string) => {
      if (key === "UPLOADS.IMAGE-MAX-BYTES") return Promise.resolve(5 * 1024 * 1024);
      if (key === "UPLOADS.VIDEO-MAX-BYTES") return Promise.resolve(50 * 1024 * 1024);
      if (key === "UPLOADS.VIDEO-MAX-DURATION-SECONDS") return Promise.resolve(300);
      return Promise.resolve(null);
    });

    mockConfigInstance.getJSON.mockImplementation((key: string) => {
      if (key === "UPLOADS.ALLOWED-MIME-IMAGE") return Promise.resolve(["image/png"]);
      if (key === "UPLOADS.ALLOWED-MIME-VIDEO") return Promise.resolve(["video/mp4"]);
      return Promise.resolve(null);
    });

    mockLocalStorage.getPublicUrl.mockImplementation((key: string) => `/local/${key}`);
  });

  const makeJsonRequest = (body: unknown): NextRequest =>
    new Request("http://localhost/api/r2/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest;

  it("returns local upload policy when S3 is not configured", async () => {
    mockGetS3Config.mockReturnValue(null);

    const response = await r2SignPost(
      makeJsonRequest({ filename: "banner.png", mimeType: "image/png", size: 1024, kind: "image" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.url).toBe("/api/uploads/local");
    expect(payload.policy.kind).toBe("image");
    expect(payload.key).toMatch(/^images\//);
  });

  it("returns presigned S3 upload information when configured", async () => {
    mockGetS3Config.mockReturnValue({ region: "us-east-1" });

    mockS3ServicePrototype.createPresignedPost.mockResolvedValue({
      url: "https://r2.example.com/upload",
      fields: { key: "images/file.png" },
      key: "images/file.png",
    });
    mockS3ServicePrototype.getPublicUrl.mockReturnValue("https://cdn.example.com/images/file.png");

    const response = await r2SignPost(
      makeJsonRequest({ filename: "file.png", mimeType: "image/png", size: 2048, kind: "image" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://r2.example.com/upload");
    expect(payload.publicUrl).toBe("https://cdn.example.com/images/file.png");
    expect(mockS3ServicePrototype.createPresignedPost).toHaveBeenCalledWith(
      "file.png",
      "image/png",
      { maxBytes: 5 * 1024 * 1024, allowedMimeTypes: ["image/png"], keyPrefix: "images" }
    );
  });

  it("validates required fields", async () => {
    const response = await r2SignPost(makeJsonRequest({ filename: "file.png" }));
    expect(response.status).toBe(400);
  });
});
