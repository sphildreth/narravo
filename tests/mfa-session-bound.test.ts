// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockConsumeGrant, mockAuth } = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), update: vi.fn() },
  mockConsumeGrant: vi.fn(),
  mockAuth: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: mockAuth,
    handlers: { GET: vi.fn(), POST: vi.fn() },
  })),
}));
vi.mock("next-auth/providers/github", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return mockDb; } }));
vi.mock("@/lib/admin", () => ({ isEmailAdmin: vi.fn(() => true) }));
vi.mock("@/lib/2fa/trusted-device", () => ({
  verifyTrustedDevice: vi.fn(),
  TRUSTED_DEVICE_COOKIE_NAME: "trusted-device",
}));
vi.mock("@/lib/2fa/session-grant", () => ({
  consumeMfaSessionGrant: (...args: unknown[]) => mockConsumeGrant(...args),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/drizzle/schema", () => ({ users: {
  id: Symbol("users.id"),
  twoFactorEnabled: Symbol("users.twoFactorEnabled"),
  twoFactorEnforcedAt: Symbol("users.twoFactorEnforcedAt"),
} }));

import { authOptions, require2FA, requireRecentLogin } from "@/lib/auth";

function prepareUserLookup() {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: true }]),
      }),
    }),
  });
}

describe("session-bound MFA JWT upgrades", () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockConsumeGrant.mockReset();
    mockAuth.mockReset();
    prepareUserLookup();
  });

  it("upgrades only the session that owns the MFA grant", async () => {
    mockConsumeGrant.mockImplementation(async ({ sessionId }: { sessionId: string }) => sessionId === "session-a");
    const jwt = authOptions.callbacks!.jwt! as any;

    const sessionA = await jwt({
      token: { userId: "user-1", email: "admin@example.com", twoFactorEnabled: true, mfaSessionId: "session-a", mfaPending: true, mfa: false },
      trigger: "update",
    } as any);
    const sessionB = await jwt({
      token: { userId: "user-1", email: "admin@example.com", twoFactorEnabled: true, mfaSessionId: "session-b", mfaPending: true, mfa: false },
      trigger: "update",
    } as any);

    expect(sessionA.mfaPending).toBe(false);
    expect(sessionA.mfa).toBe(true);
    expect(sessionB.mfaPending).toBe(true);
    expect(sessionB.mfa).toBe(false);
    expect(mockConsumeGrant).toHaveBeenCalledWith({ userId: "user-1", sessionId: "session-a" });
    expect(mockConsumeGrant).toHaveBeenCalledWith({ userId: "user-1", sessionId: "session-b" });
  });

  it("ignores client-provided MFA flags during a forged update request", async () => {
    mockConsumeGrant.mockResolvedValue(false);
    const jwt = authOptions.callbacks!.jwt! as any;

    const result = await jwt({
      token: { userId: "user-1", email: "admin@example.com", twoFactorEnabled: true, mfaSessionId: "session-a", mfaPending: true, mfa: false },
      trigger: "update",
      session: { user: { mfa: true, mfaPending: false }, mfa: true, mfaPending: false },
    } as any);

    expect(result.mfaPending).toBe(true);
    expect(result.mfa).toBe(false);
  });

  it("does not preserve upgraded state for a legacy token without a session identifier", async () => {
    mockConsumeGrant.mockResolvedValue(false);
    const jwt = authOptions.callbacks!.jwt! as any;

    const result = await jwt({
      token: { userId: "user-1", email: "admin@example.com", twoFactorEnabled: true, mfaPending: false, mfa: true },
      trigger: "update",
    } as any);

    expect(result.mfaPending).toBe(true);
    expect(result.mfa).toBe(false);
  });

  it("requires the session MFA proof to match the live enrollment epoch", async () => {
    const enrolledAt = new Date("2026-08-30T12:00:00.000Z");
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: true, twoFactorEnforcedAt: enrolledAt }]),
        }),
      }),
    });
    mockAuth.mockResolvedValue({
      user: {
        id: "user-1",
        twoFactorEnabled: true,
        mfaPending: false,
        mfaSessionId: "session-a",
        mfaEnforcedAt: enrolledAt.toISOString(),
      },
      mfa: true,
      mfaSessionId: "session-a",
      mfaEnforcedAt: enrolledAt.toISOString(),
    });

    await expect(require2FA()).resolves.toMatchObject({ mfa: true });

    mockAuth.mockResolvedValue({
      user: {
        id: "user-1",
        twoFactorEnabled: true,
        mfaPending: false,
        mfaSessionId: "session-a",
        mfaEnforcedAt: "2026-08-29T12:00:00.000Z",
      },
      mfa: true,
      mfaSessionId: "session-a",
      mfaEnforcedAt: "2026-08-29T12:00:00.000Z",
    });

    await expect(require2FA()).rejects.toThrow("2FA verification required");
  });

  it("rejects legacy sessions that have no server-issued MFA session ID", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", twoFactorEnabled: true, mfaPending: false },
      mfa: true,
    });

    await expect(require2FA()).rejects.toThrow("Session refresh required");
  });

  it("requires a recent signed login timestamp for initial enrollment", () => {
    expect(() => requireRecentLogin({ loginIssuedAt: Date.now() - 60_000 })).not.toThrow();
    expect(() => requireRecentLogin({ loginIssuedAt: Date.now() - 16 * 60_000 })).toThrow("Recent sign-in required");
    expect(() => requireRecentLogin({})).toThrow("Recent sign-in required");
  });
});
