import { describe, it, expect, vi, beforeEach } from "vitest";
import { __testables__ } from "@/lib/jobs";

const { generateVideoPoster, validateVideoDuration } = __testables__;

// Mock database
const mockDb = {
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
};

// Mock S3 service
const mockS3Service = {
  getPublicUrl: vi.fn().mockReturnValue("https://example.com/poster.jpg"),
};

describe("generateVideoPoster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate poster URL and update database", async () => {
    const job = {
      attachmentId: "test-attachment-id",
      videoUrl: "https://example.com/video.mp4",
      videoKey: "videos/test-video.mp4",
    };

    const context = {
      db: mockDb as any,
      s3Service: mockS3Service as any,
    };

    await generateVideoPoster(job, context);

    expect(mockS3Service.getPublicUrl).toHaveBeenCalledWith("videos/test-video-poster.jpg");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("should work without S3 service (development mode)", async () => {
    const job = {
      attachmentId: "test-attachment-id",
      videoUrl: "https://example.com/video.mp4",
      videoKey: "videos/test-video.mp4",
    };

    const context = {
      db: mockDb as any,
      s3Service: undefined,
    };

    await generateVideoPoster(job, context);

    expect(mockDb.update).toHaveBeenCalled();
  });

  it("should handle errors gracefully", async () => {
    const job = {
      attachmentId: "test-attachment-id",
      videoUrl: "https://example.com/video.mp4",
      videoKey: "videos/test-video.mp4",
    };

    const context = {
      db: {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        }),
      } as any,
      s3Service: mockS3Service as any,
    };

    await expect(generateVideoPoster(job, context)).rejects.toThrow("Database error");
  });
});

describe("validateVideoDuration", () => {
  it("should always return true in MVP", async () => {
    const result = await validateVideoDuration("https://example.com/video.mp4", 90);
    expect(result).toBe(true);
  });
});