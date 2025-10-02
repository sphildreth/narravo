// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET as statusGet } from "@/app/api/2fa/status/route";
import { DELETE as disableDelete } from "@/app/api/2fa/disable/route";

const mockRequireAdmin = vi.fn();
const mockRequireAdmin2FA = vi.fn();
const mockDb = {
  select: vi.fn(),
  transaction: vi.fn(),
};

const mockTrustedDevices = {
  revokeAllTrustedDevices: vi.fn(),
};

const mockSecurityActivity = {
  logSecurityActivity: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requireAdmin2FA: (...args: unknown[]) => mockRequireAdmin2FA(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/lib/2fa/trusted-device", () => ({
  revokeAllTrustedDevices: (...args: unknown[]) => mockTrustedDevices.revokeAllTrustedDevices(...args),
}));

vi.mock("@/lib/2fa/security-activity", () => ({
  logSecurityActivity: (...args: unknown[]) => mockSecurityActivity.logSecurityActivity(...args),
}));

vi.mock("@/drizzle/schema", () => ({
  ownerTotp: Symbol("ownerTotp"),
  ownerWebAuthnCredential: Symbol("ownerWebAuthnCredential"),
  ownerRecoveryCode: Symbol("ownerRecoveryCode"),
  users: Symbol("users"),
}));

describe("2FA status and disable endpoints", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ user: { id: "user-1", twoFactorEnabled: true } });
    mockRequireAdmin2FA.mockReset();
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "user-1" } });

    mockDb.select.mockReset();
    mockDb.transaction.mockReset();

    mockTrustedDevices.revokeAllTrustedDevices.mockReset();
    mockSecurityActivity.logSecurityActivity.mockReset();
  });

  const makeRequest = (url: string, init?: RequestInit): NextRequest => {
    return new Request(url, init) as unknown as NextRequest;
  };

  it("aggregates current 2FA status", async () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const nowIso = now.toISOString();

    mockDb.select
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ activatedAt: now }]),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve([
            { id: "cred-1", nickname: "Laptop", createdAt: now, lastUsedAt: null },
          ])),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve([
            { id: "rc-1", usedAt: null },
            { id: "rc-2", usedAt: now },
          ])),
        }),
      }));

    const response = await statusGet(makeRequest("http://localhost/api/2fa/status"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      twoFactorEnabled: true,
      totp: {
        enabled: true,
        activatedAt: nowIso,
      },
      webauthn: {
        count: 1,
        credentials: [
          {
            id: "cred-1",
            nickname: "Laptop",
            createdAt: nowIso,
            lastUsedAt: null,
          },
        ],
      },
      recoveryCodes: {
        total: 2,
        unused: 1,
      },
    });
  });

  it("disables 2FA and revokes trusted devices", async () => {
    const txUpdate = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const txDeleteWhere = vi.fn().mockResolvedValue(undefined);

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn({
        update: () => ({ set: txUpdate }),
        delete: () => ({ where: txDeleteWhere }),
      });
    });

    const response = await disableDelete(makeRequest("http://localhost/api/2fa/disable", { method: "DELETE" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockTrustedDevices.revokeAllTrustedDevices).toHaveBeenCalledWith("user-1");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith("user-1", "2fa_disabled");
    expect(txDeleteWhere).toHaveBeenCalled();
  });

  it("returns error when admin check fails", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Unauthorized"));

    const response = await statusGet(makeRequest("http://localhost/api/2fa/status"));
    expect(response.status).toBe(500);
  });

  it("fails disabling when admin 2FA check fails", async () => {
    mockRequireAdmin2FA.mockRejectedValueOnce(new Error("Forbidden"));

    const response = await disableDelete(makeRequest("http://localhost/api/2fa/disable", { method: "DELETE" }));
    expect(response.status).toBe(500);
  });
});
