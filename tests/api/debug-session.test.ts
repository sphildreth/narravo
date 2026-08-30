// SPDX-License-Identifier: Apache-2.0
// Tests for the debug session inspection API route.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as debugSessionGet } from "@/app/api/debug/session/route";

const mockRequireSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

describe("/api/debug/session", () => {
  beforeEach(() => {
    mockRequireSession.mockReset();
  });

  it("returns session details when user authenticated", async () => {
    mockRequireSession.mockResolvedValue({
      user: {
        email: "admin@example.com",
        twoFactorEnabled: true,
        mfaPending: false,
        mfa: { totp: true },
      },
    });

    const response = await debugSessionGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      authenticated: true,
      user: {
        email: "admin@example.com",
        twoFactorEnabled: true,
        mfaPending: false,
        mfa: { totp: true },
      },
    });
    expect(mockRequireSession).toHaveBeenCalledTimes(1);
  });

  it("rejects requests with no session", async () => {
    mockRequireSession.mockRejectedValue(new Error("Unauthorized"));

    const response = await debugSessionGet();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
  });
});
