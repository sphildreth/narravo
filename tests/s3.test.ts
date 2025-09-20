import { describe, it, expect, vi, beforeEach } from "vitest";
import { S3Service, getS3Config, validateFileType } from "@/lib/s3";

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://presigned.url"),
}));

describe("S3Service", () => {
  const mockConfig = {
    region: "us-east-1",
    endpoint: "https://example.com",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
  };

  let s3Service: S3Service;

  beforeEach(() => {
    s3Service = new S3Service(mockConfig);
  });

  it("should create presigned URL for valid file", async () => {
    const result = await s3Service.createPresignedPost(
      "test.jpg",
      "image/jpeg",
      {
        maxBytes: 5000000,
        allowedMimeTypes: ["image/jpeg", "image/png"],
      }
    );

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("fields");
    expect(result).toHaveProperty("key");
    expect(result.key).toMatch(/^uploads\/[a-zA-Z0-9_-]+\.jpg$/);
  });

  it("should reject invalid MIME types", async () => {
    await expect(
      s3Service.createPresignedPost("test.exe", "application/exe", {
        maxBytes: 5000000,
        allowedMimeTypes: ["image/jpeg", "image/png"],
      })
    ).rejects.toThrow("MIME type application/exe not allowed");
  });

  it("should generate public URL correctly", () => {
    const url = s3Service.getPublicUrl("uploads/test.jpg");
    expect(url).toBe("https://example.com/test-bucket/uploads/test.jpg");
  });
});

describe("getS3Config", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
  });

  it("should return null when environment variables are missing", () => {
    const config = getS3Config();
    expect(config).toBeNull();
  });

  it("should return config when all required variables are present", () => {
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ACCESS_KEY_ID = "test-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret";
    process.env.S3_BUCKET = "test-bucket";

    const config = getS3Config();
    expect(config).toEqual({
      region: "us-east-1",
      endpoint: undefined,
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucket: "test-bucket",
    });
  });
});

describe("validateFileType", () => {
  it("should validate PNG files correctly", () => {
    // PNG magic bytes: 89 50 4E 47
    const pngBuffer = new ArrayBuffer(16);
    const view = new Uint8Array(pngBuffer);
    view[0] = 0x89;
    view[1] = 0x50;
    view[2] = 0x4e;
    view[3] = 0x47;

    expect(validateFileType(pngBuffer, "image/png")).toBe(true);
    expect(validateFileType(pngBuffer, "image/jpeg")).toBe(false);
  });

  it("should validate JPEG files correctly", () => {
    // JPEG magic bytes: FF D8 FF
    const jpegBuffer = new ArrayBuffer(16);
    const view = new Uint8Array(jpegBuffer);
    view[0] = 0xff;
    view[1] = 0xd8;
    view[2] = 0xff;

    expect(validateFileType(jpegBuffer, "image/jpeg")).toBe(true);
    expect(validateFileType(jpegBuffer, "image/png")).toBe(false);
  });

  it("should handle unknown file types", () => {
    const unknownBuffer = new ArrayBuffer(16);
    expect(validateFileType(unknownBuffer, "image/jpeg")).toBe(false);
  });
});