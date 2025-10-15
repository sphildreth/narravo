// SPDX-License-Identifier: Apache-2.0
// Tests for the admin comment moderation API route.
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as moderateCommentsPost } from "@/app/api/admin/comments/moderate/route";
import type { ModerateInput } from "@/lib/adminModeration";

const { mockRequireAdmin, mockModerateComments, mockLogger } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockModerateComments: vi.fn(),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/adminModeration", () => ({
  moderateComments: (...args: unknown[]) => mockModerateComments(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

describe("/api/admin/comments/moderate", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockModerateComments.mockReset();
    Object.values(mockLogger).forEach((fn) => fn.mockReset?.());

    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
  });

  const makeJsonRequest = (body: ModerateInput): NextRequest =>
    new Request("http://localhost/api/admin/comments/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest;

  it("moderates comments via service and returns results", async () => {
    const requestBody: ModerateInput = { action: "approve", ids: ["comment-1", "comment-2"] };
    const moderationResult = [
      { id: "comment-1", ok: true },
      { id: "comment-2", ok: false, message: "Already approved" },
    ];
    mockModerateComments.mockResolvedValue(moderationResult);

    const response = await moderateCommentsPost(makeJsonRequest(requestBody));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, results: moderationResult });
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(mockModerateComments).toHaveBeenCalledWith(
      expect.objectContaining({
        updateStatus: expect.any(Function),
        hardDelete: expect.any(Function),
        editComment: expect.any(Function),
        removeAttachment: expect.any(Function),
      }),
      requestBody
    );
  });

  it("returns 403 when admin authentication fails", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

    const response = await moderateCommentsPost(makeJsonRequest({ action: "approve", ids: ["comment-3"] }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(mockModerateComments).not.toHaveBeenCalled();
  });

  it("logs and maps moderation errors to 400", async () => {
    mockModerateComments.mockRejectedValueOnce(new Error("invalid action"));

    const response = await moderateCommentsPost(makeJsonRequest({ action: "approve", ids: [] }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toBe("invalid action");
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
