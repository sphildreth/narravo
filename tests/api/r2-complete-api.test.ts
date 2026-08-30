// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as completePost } from "@/app/api/r2/complete/route";

const state = vi.hoisted(() => ({
  requireSession: vi.fn(),
  verifyUploadToken: vi.fn(),
  getS3Config: vi.fn(),
  service: {
    getObjectBytes: vi.fn(),
    deleteObject: vi.fn(),
    getPublicUrl: vi.fn(),
  },
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSession: (...args: unknown[]) => state.requireSession(...args),
}));
vi.mock("@/lib/upload-signing", () => ({
  verifyUploadToken: (...args: unknown[]) => state.verifyUploadToken(...args),
}));
vi.mock("@/lib/s3", () => ({
  getS3Config: (...args: unknown[]) => state.getS3Config(...args),
  S3Service: vi.fn(function() { return state.service; }),
}));
vi.mock("@/lib/db", () => ({
  get db() { return state.db; },
}));
vi.mock("@/drizzle/schema", () => ({
  uploads: {
    id: Symbol("uploads.id"),
    key: Symbol("uploads.key"),
    userId: Symbol("uploads.userId"),
  },
}));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("/api/r2/complete", () => {
  beforeEach(() => {
    state.requireSession.mockReset();
    state.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    state.verifyUploadToken.mockReset();
    state.verifyUploadToken.mockReturnValue({
      key: "staging-key",
      kind: "image",
      mimeType: "image/png",
      size: png.byteLength,
      maxBytes: 5_000_000,
      userId: "user-1",
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    state.getS3Config.mockReset();
    state.getS3Config.mockReturnValue({ region: "us-east-1" });
    state.service.getObjectBytes.mockReset();
    state.service.getObjectBytes.mockResolvedValue(png);
    state.service.deleteObject.mockReset();
    state.service.deleteObject.mockResolvedValue(undefined);
    state.service.getPublicUrl.mockReset();
    state.service.getPublicUrl.mockReturnValue("https://cdn.example/images/final.png");
    state.db.select.mockReset();
    state.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });
    state.db.insert.mockReset();
    state.db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "upload-1" }]),
        }),
      }),
    });
  });

  const request = (body: unknown): NextRequest => new Request("http://localhost/api/r2/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

  it("publishes only bytes matching the signed upload policy", async () => {
    const response = await completePost(request({ key: "staging-key", uploadToken: "valid" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.key).toBe("staging-key");
    expect(payload.mimeType).toBe("image/png");
    expect(state.service.getObjectBytes).toHaveBeenCalledWith("staging-key", 5_000_000);
    expect(state.db.insert).toHaveBeenCalled();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("deletes an object whose bytes do not match the signed type", async () => {
    state.service.getObjectBytes.mockResolvedValue(new TextEncoder().encode("<svg/>"));

    const response = await completePost(request({ key: "staging-key", uploadToken: "valid" }));

    expect(response.status).toBe(400);
    expect(state.service.deleteObject).toHaveBeenCalledWith("staging-key");
    expect(state.db.insert).not.toHaveBeenCalled();
  });

  it("does not accept a token issued to another user or key", async () => {
    state.verifyUploadToken.mockReturnValue({
      key: "other-key",
      kind: "image",
      mimeType: "image/png",
      size: png.byteLength,
      maxBytes: 5_000_000,
      userId: "other-user",
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });

    const response = await completePost(request({ key: "staging-key", uploadToken: "valid" }));

    expect(response.status).toBe(400);
    expect(state.service.getObjectBytes).not.toHaveBeenCalled();
  });
});
