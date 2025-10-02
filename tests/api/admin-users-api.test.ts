// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as anonymizePost } from "@/app/api/admin/users/anonymize/route";

const mockRequireAdmin = vi.fn();
const mockAnonymizeUser = vi.fn();
const mockDb = {
  delete: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/adminUsers", () => ({
  anonymizeUser: (...args: unknown[]) => mockAnonymizeUser(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/drizzle/schema", () => ({
  users: Symbol("users-table"),
}));

describe("/api/admin/users/anonymize", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    mockAnonymizeUser.mockReset();
    mockDb.delete.mockReset();
  });

  const makeRequest = (body: unknown): NextRequest => {
    const request = new Request("http://localhost/api/admin/users/anonymize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return request as unknown as NextRequest;
  };

  it("anonymizes by user id", async () => {
    mockAnonymizeUser.mockResolvedValue({ ok: true, deleted: 1, mode: "id" });

    const response = await anonymizePost(makeRequest({ userId: "user-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, deleted: 1, mode: "id" });
    expect(mockAnonymizeUser).toHaveBeenCalledWith(expect.anything(), { userId: "user-1", email: undefined });
  });

  it("propagates validation failures", async () => {
    mockAnonymizeUser.mockRejectedValue(new Error("Identifier required"));

    const response = await anonymizePost(makeRequest({}));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toBe("Identifier required");
  });

  it("maps auth errors to 403", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

    const response = await anonymizePost(makeRequest({ userId: "user-1" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
  });
});
