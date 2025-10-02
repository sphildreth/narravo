// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as totpInitPost } from "@/app/api/2fa/totp/init/route";
import { POST as totpConfirmPost } from "@/app/api/2fa/totp/confirm/route";
import { POST as totpVerifyPost } from "@/app/api/2fa/totp/verify/route";

const mockRequireAdmin = vi.fn();
const mockRequireSession = vi.fn();
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

const mockTotp = {
  generateTotpSecret: vi.fn(),
  generateTotpUri: vi.fn(),
  generateQrCodeDataUrl: vi.fn(),
  verifyTotpCode: vi.fn(),
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
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/lib/2fa/totp", () => ({
  generateTotpSecret: (...args: unknown[]) => mockTotp.generateTotpSecret(...args),
  generateTotpUri: (...args: unknown[]) => mockTotp.generateTotpUri(...args),
  generateQrCodeDataUrl: (...args: unknown[]) => mockTotp.generateQrCodeDataUrl(...args),
  verifyTotpCode: (...args: unknown[]) => mockTotp.verifyTotpCode(...args),
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
  ownerTotp: Symbol("ownerTotp"),
  ownerRecoveryCode: Symbol("ownerRecoveryCode"),
  users: Symbol("users"),
}));

describe("2FA TOTP endpoints", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ user: { id: "user-1", email: "admin@example.com" } });

    mockRequireSession.mockReset();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1", mfaPending: true } });

    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.transaction.mockReset();

    mockTotp.generateTotpSecret.mockReset();
    mockTotp.generateTotpUri.mockReset();
    mockTotp.generateQrCodeDataUrl.mockReset();
    mockTotp.verifyTotpCode.mockReset();
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

  it("initializes a new TOTP secret", async () => {
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const onConflict = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflict });
    mockDb.insert.mockReturnValue({ values });

    mockTotp.generateTotpSecret.mockReturnValue("SECRET");
    mockTotp.generateTotpUri.mockReturnValue("otpauth://totp/secret");
    mockTotp.generateQrCodeDataUrl.mockResolvedValue("data:image/png;base64,QR");

    const response = await totpInitPost(makeJsonRequest("http://localhost/api/2fa/totp/init", {}));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ secret: "SECRET", uri: "otpauth://totp/secret", qrCode: "data:image/png;base64,QR" });
    expect(mockTotp.generateTotpSecret).toHaveBeenCalled();
    expect(values).toHaveBeenCalled();
    expect(onConflict).toHaveBeenCalled();
  });

  it("prevents initializing when TOTP already active", async () => {
    const activatedAt = new Date();
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ activatedAt }]),
        }),
      }),
    }));

    const response = await totpInitPost(makeJsonRequest("http://localhost/api/2fa/totp/init", {}));
    expect(response.status).toBe(400);
  });

  it("confirms TOTP enrollment and generates recovery codes", async () => {
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: "user-1", secretBase32: "SECRET", activatedAt: null }]),
        }),
      }),
    }));

    mockTotp.verifyTotpCode.mockReturnValue(123456);
    mockTotp.generateRecoveryCodes.mockReturnValue(["code-1", "code-2"]);
    mockTotp.hashRecoveryCode.mockImplementation((code: string) => `hash-${code}`);

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn({
        update: () => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
      });
    });

    const response = await totpConfirmPost(makeJsonRequest("http://localhost/api/2fa/totp/confirm", { code: "123456" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.recoveryCodes).toEqual(["code-1", "code-2"]);
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith("user-1", "2fa_enabled");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith("user-1", "totp_activated");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "recovery_codes_generated",
      { count: 2 }
    );
  });

  it("rejects invalid confirmation codes", async () => {
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ userId: "user-1", secretBase32: "SECRET", activatedAt: null }]),
        }),
      }),
    }));

    mockTotp.verifyTotpCode.mockReturnValue(null);

    const response = await totpConfirmPost(makeJsonRequest("http://localhost/api/2fa/totp/confirm", { code: "000000" }));
    expect(response.status).toBe(400);
  });

  it("verifies TOTP codes and issues trusted device tokens", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(false);

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ secretBase32: "SECRET", activatedAt: new Date(), lastUsedStep: 100 }]),
        }),
      }),
    }));

    mockTotp.verifyTotpCode.mockReturnValue(101);

    mockDb.update
      .mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }))
      .mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }));

    mockRateLimit.resetRateLimit.mockResolvedValue(undefined);
    mockTrustedDevice.createTrustedDevice.mockResolvedValue("device-token");

    const response = await totpVerifyPost(makeJsonRequest("http://localhost/api/2fa/totp/verify", { code: "123456", rememberDevice: true }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockRateLimit.resetRateLimit).toHaveBeenCalledWith("2fa:totp:user-1");
    expect(mockTrustedDevice.createTrustedDevice).toHaveBeenCalled();
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("trusted-device=");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "trusted_device_added",
      { userAgent: null }
    );
  });

  it("enforces rate limits on repeated failures", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(true);

    const response = await totpVerifyPost(makeJsonRequest("http://localhost/api/2fa/totp/verify", { code: "000000" }));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error).toBe("Too many attempts. Please try again later.");
  });
});
