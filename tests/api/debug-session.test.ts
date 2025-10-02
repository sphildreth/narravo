// SPDX-License-Identifier: Apache-2.0
// Tests for the debug session inspection API route.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as debugSessionGet } from "@/app/api/debug/session/route";

const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

describe("/api/debug/session", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it("returns session details when user authenticated", async () => {
    mockGetSession.mockResolvedValue({
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
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("returns unauthenticated state when no session", async () => {
    mockGetSession.mockResolvedValue(undefined);

    const response = await debugSessionGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ authenticated: false, user: null });
  });
});
