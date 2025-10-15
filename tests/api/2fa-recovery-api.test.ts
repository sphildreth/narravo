// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as recoveryVerifyPost } from "@/app/api/2fa/recovery/verify/route";
import { POST as recoveryRegeneratePost } from "@/app/api/2fa/recovery/regenerate/route";

const mockRequireSession = vi.fn();
const mockRequireAdmin2FA = vi.fn();
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

const mockTotp = {
  verifyRecoveryCode: vi.fn(),
  generateRecoveryCodes: vi.fn(),
  hashRecoveryCode: vi.fn(),
};

const mockRateLimit = {
  isRateLimited: vi.fn(),
  resetRateLimit: vi.fn(),
};

const mockTrustedDevice = {
  createTrustedDevice: vi.fn(),
  TRUSTED_DEVICE_COOKIE_NAME: "trusted-device",
};

const mockSecurityActivity = {
  logSecurityActivity: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  requireAdmin2FA: (...args: unknown[]) => mockRequireAdmin2FA(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/lib/2fa/totp", () => ({
  verifyRecoveryCode: (...args: unknown[]) => mockTotp.verifyRecoveryCode(...args),
  generateRecoveryCodes: (...args: unknown[]) => mockTotp.generateRecoveryCodes(...args),
  hashRecoveryCode: (...args: unknown[]) => mockTotp.hashRecoveryCode(...args),
}));

vi.mock("@/lib/2fa/rate-limit", () => ({
  isRateLimited: (...args: unknown[]) => mockRateLimit.isRateLimited(...args),
  resetRateLimit: (...args: unknown[]) => mockRateLimit.resetRateLimit(...args),
}));

vi.mock("@/lib/2fa/trusted-device", () => ({
  get createTrustedDevice() {
    return mockTrustedDevice.createTrustedDevice;
  },
  get TRUSTED_DEVICE_COOKIE_NAME() {
    return mockTrustedDevice.TRUSTED_DEVICE_COOKIE_NAME;
  },
}));

vi.mock("@/lib/2fa/security-activity", () => ({
  logSecurityActivity: (...args: unknown[]) => mockSecurityActivity.logSecurityActivity(...args),
}));

vi.mock("@/drizzle/schema", () => ({
  ownerRecoveryCode: Symbol("ownerRecoveryCode"),
  users: Symbol("users"),
}));

describe("2FA recovery endpoints", () => {
  beforeEach(() => {
    mockRequireSession.mockReset();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1", mfaPending: true } });

    mockRequireAdmin2FA.mockReset();
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "user-1" } });

    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.transaction.mockReset();

    mockTotp.verifyRecoveryCode.mockReset();
    mockTotp.generateRecoveryCodes.mockReset();
    mockTotp.hashRecoveryCode.mockReset();

    mockRateLimit.isRateLimited.mockReset();
    mockRateLimit.resetRateLimit.mockReset();

    mockTrustedDevice.createTrustedDevice.mockReset();
    mockSecurityActivity.logSecurityActivity.mockReset();
  });

  const makeJsonRequest = (url: string, body: unknown): NextRequest => {
    return new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest;
  };

  it("verifies recovery codes and upgrades session", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(false);

    const recoveryCodes = [
      { id: "rc-1", codeHash: "hash-1", usedAt: null },
      { id: "rc-2", codeHash: "hash-2", usedAt: null },
    ];

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve(recoveryCodes)),
      }),
    }));

    mockTotp.verifyRecoveryCode
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    mockDb.update
      .mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }))
      .mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }));

    mockTrustedDevice.createTrustedDevice.mockResolvedValue("trusted-token");

    const response = await recoveryVerifyPost(
      makeJsonRequest("http://localhost/api/2fa/recovery/verify", { code: "CODE-0002", rememberDevice: true })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.remainingCodes).toBe(1);
    expect(mockRateLimit.resetRateLimit).toHaveBeenCalledWith("2fa:recovery:user-1");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "recovery_code_used",
      { remainingCodes: 1 }
    );
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("trusted-device=");
  });

  it("enforces recovery code rate limiting", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(true);

    const response = await recoveryVerifyPost(
      makeJsonRequest("http://localhost/api/2fa/recovery/verify", { code: "VALID1234" })
    );
    expect(response.status).toBe(429);
  });

  it("rejects when no recovery codes remain", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(false);

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve([])),
      }),
    }));

    const response = await recoveryVerifyPost(
      makeJsonRequest("http://localhost/api/2fa/recovery/verify", { code: "CODE" })
    );
    expect(response.status).toBe(400);
  });

  it("regenerates recovery codes for admins", async () => {
    mockTotp.generateRecoveryCodes.mockReturnValue(["code-1", "code-2", "code-3"]);
    mockTotp.hashRecoveryCode.mockImplementation((code: string) => `hash-${code}`);

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn({
        delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
      });
    });

    const response = await recoveryRegeneratePost(
      makeJsonRequest("http://localhost/api/2fa/recovery/regenerate", {})
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.recoveryCodes).toEqual(["code-1", "code-2", "code-3"]);
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "recovery_codes_generated",
      { count: 3 }
    );
  });
});
