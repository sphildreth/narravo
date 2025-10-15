// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as registerOptionsPost } from "@/app/api/2fa/webauthn/register/options/route";
import { POST as registerVerifyPost } from "@/app/api/2fa/webauthn/register/verify/route";
import { POST as authenticateOptionsPost } from "@/app/api/2fa/webauthn/authenticate/options/route";
import { POST as authenticateVerifyPost } from "@/app/api/2fa/webauthn/authenticate/verify/route";
import { DELETE as credentialsDelete } from "@/app/api/2fa/webauthn/credentials/[id]/route";
import { POST as confirmPost } from "@/app/api/2fa/webauthn/confirm/route";

const { mockRequireAdmin, mockRequireAdmin2FA, mockRequireSession, mockDb, mockWebauthn, mockTotp, mockRateLimit, mockTrustedDevice, mockSecurityActivity } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockRequireAdmin2FA: vi.fn(),
    mockRequireSession: vi.fn(),
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
    mockWebauthn: {
      generateWebAuthnRegistrationOptions: vi.fn(),
      verifyWebAuthnRegistration: vi.fn(),
      generateWebAuthnAuthenticationOptions: vi.fn(),
      verifyWebAuthnAuthentication: vi.fn(),
    },
    mockTotp: {
      generateRecoveryCodes: vi.fn(),
      hashRecoveryCode: vi.fn(),
    },
    mockRateLimit: {
      isRateLimited: vi.fn(),
      resetRateLimit: vi.fn(),
    },
    mockTrustedDevice: {
      createTrustedDevice: vi.fn(),
      TRUSTED_DEVICE_COOKIE_NAME: "trusted-device",
    },
    mockSecurityActivity: {
      logSecurityActivity: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requireAdmin2FA: (...args: unknown[]) => mockRequireAdmin2FA(...args),
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/lib/2fa/webauthn", () => ({
  generateWebAuthnRegistrationOptions: (...args: unknown[]) => mockWebauthn.generateWebAuthnRegistrationOptions(...args),
  verifyWebAuthnRegistration: (...args: unknown[]) => mockWebauthn.verifyWebAuthnRegistration(...args),
  generateWebAuthnAuthenticationOptions: (...args: unknown[]) => mockWebauthn.generateWebAuthnAuthenticationOptions(...args),
  verifyWebAuthnAuthentication: (...args: unknown[]) => mockWebauthn.verifyWebAuthnAuthentication(...args),
}));

vi.mock("@/lib/2fa/totp", () => ({
  generateRecoveryCodes: (...args: unknown[]) => mockTotp.generateRecoveryCodes(...args),
  hashRecoveryCode: (...args: unknown[]) => mockTotp.hashRecoveryCode(...args),
}));

vi.mock("@/lib/2fa/rate-limit", () => ({
  isRateLimited: (...args: unknown[]) => mockRateLimit.isRateLimited(...args),
  resetRateLimit: (...args: unknown[]) => mockRateLimit.resetRateLimit(...args),
}));

vi.mock("@/lib/2fa/trusted-device", () => ({
  createTrustedDevice: (...args: unknown[]) => mockTrustedDevice.createTrustedDevice(...args),
  TRUSTED_DEVICE_COOKIE_NAME: mockTrustedDevice.TRUSTED_DEVICE_COOKIE_NAME,
}));

vi.mock("@/lib/2fa/security-activity", () => ({
  logSecurityActivity: (...args: unknown[]) => mockSecurityActivity.logSecurityActivity(...args),
}));

vi.mock("@/drizzle/schema", () => ({
  ownerWebAuthnCredential: Symbol("ownerWebAuthnCredential"),
  ownerRecoveryCode: Symbol("ownerRecoveryCode"),
  users: Symbol("users"),
}));

const encodeClientData = (challenge: string) =>
  Buffer.from(JSON.stringify({ challenge }), "utf8").toString("base64");

describe("WebAuthn 2FA endpoints", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ user: { id: "user-1", email: "admin@example.com", name: "Admin" } });

    mockRequireAdmin2FA.mockReset();
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "user-1" } });

    mockRequireSession.mockReset();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1", mfaPending: true } });

    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
    mockDb.transaction.mockReset();

    mockWebauthn.generateWebAuthnRegistrationOptions.mockReset();
    mockWebauthn.verifyWebAuthnRegistration.mockReset();
    mockWebauthn.generateWebAuthnAuthenticationOptions.mockReset();
    mockWebauthn.verifyWebAuthnAuthentication.mockReset();

    mockTotp.generateRecoveryCodes.mockReset();
    mockTotp.hashRecoveryCode.mockReset();

    mockRateLimit.isRateLimited.mockReset();
    mockRateLimit.resetRateLimit.mockReset();

    mockTrustedDevice.createTrustedDevice.mockReset();
    mockSecurityActivity.logSecurityActivity.mockReset();
  });

  const makeJsonRequest = (url: string, body: unknown): NextRequest =>
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest;

  it("generates registration options excluding existing credentials", async () => {
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve([
          { credentialId: "cred-1", transports: ["usb"] },
        ])),
      }),
    }));

    const options = { challenge: "abc", rp: { name: "Narravo" } };
    mockWebauthn.generateWebAuthnRegistrationOptions.mockResolvedValue(options);

    const response = await registerOptionsPost(makeJsonRequest("http://localhost/api/2fa/webauthn/register/options", {}));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(options);
    expect(mockWebauthn.generateWebAuthnRegistrationOptions).toHaveBeenCalledWith(
      "user-1",
      "admin@example.com",
      "Admin",
      [{ credentialId: "cred-1", transports: ["usb"] }]
    );
  });

  it("verifies new passkey registrations", async () => {
    const clientData = encodeClientData("challenge-123");
    const baseResponse = {
      id: "cred-2",
      rawId: "cred-2",
      response: {
        clientDataJSON: clientData,
        attestationObject: "attestation",
        transports: ["nfc"],
      },
      type: "public-key",
      clientExtensionResults: {},
    } as const;

    mockWebauthn.verifyWebAuthnRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "cred-2",
          publicKey: Buffer.from("public-key"),
          counter: 0,
        },
      },
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const response = await registerVerifyPost(
      makeJsonRequest("http://localhost/api/2fa/webauthn/register/verify", baseResponse)
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockWebauthn.verifyWebAuthnRegistration).toHaveBeenCalled();
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "passkey_added",
      { nickname: undefined }
    );
  });

  it("creates authentication options for pending MFA sessions", async () => {
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve([
          { credentialId: "cred-1", transports: ["nfc"] },
        ])),
      }),
    }));

    const options = { challenge: "auth-chal" };
    mockWebauthn.generateWebAuthnAuthenticationOptions.mockResolvedValue(options);

    const response = await authenticateOptionsPost(
      makeJsonRequest("http://localhost/api/2fa/webauthn/authenticate/options", {})
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(options);
    expect(mockWebauthn.generateWebAuthnAuthenticationOptions).toHaveBeenCalledWith([
      { credentialId: "cred-1", transports: ["nfc"] },
    ]);
  });

  it("verifies WebAuthn authentications and remembers devices", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(false);

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: "internal-cred",
              credentialId: "cred-1",
              publicKey: Buffer.from("public").toString("base64"),
              counter: 10,
            },
          ]),
        }),
      }),
    }));

    mockWebauthn.verifyWebAuthnAuthentication.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 11,
      },
    });

    mockDb.update
      .mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }))
      .mockImplementationOnce(() => ({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }));

    mockTrustedDevice.createTrustedDevice.mockResolvedValue("trusted-token");

    const clientData = encodeClientData("challenge-123");
    const authResponse = {
      id: "cred-1",
      rawId: "cred-1",
      type: "public-key",
      response: {
        clientDataJSON: clientData,
        authenticatorData: "auth-data",
        signature: "sig",
        userHandle: null,
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
      rememberDevice: true,
    } as const;

    const response = await authenticateVerifyPost(
      makeJsonRequest("http://localhost/api/2fa/webauthn/authenticate/verify", authResponse)
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockRateLimit.resetRateLimit).toHaveBeenCalledWith("2fa:webauthn:user-1");
    expect(mockTrustedDevice.createTrustedDevice).toHaveBeenCalled();
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("trusted-device=");
  });

  it("rate limits WebAuthn authentication attempts", async () => {
    mockRateLimit.isRateLimited.mockReturnValue(true);

    const clientData = encodeClientData("challenge-123");
    const authResponse = {
      id: "cred-1",
      rawId: "cred-1",
      type: "public-key",
      response: {
        clientDataJSON: clientData,
        authenticatorData: "auth",
        signature: "sig",
        userHandle: null,
      },
      clientExtensionResults: {},
    } as const;

    const response = await authenticateVerifyPost(
      makeJsonRequest("http://localhost/api/2fa/webauthn/authenticate/verify", authResponse)
    );
    expect(response.status).toBe(429);
  });

  it("deletes stored credentials", async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { credentialId: "cred-1", nickname: "Laptop" },
        ]),
      }),
    });

    const response = await credentialsDelete(
      "" as unknown as Request,
      { params: Promise.resolve({ id: "internal-cred" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "passkey_removed",
      { credentialId: "cred-1", nickname: "Laptop" }
    );
  });

  it("enables passkey-only 2FA via confirm endpoint", async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: "user-1", twoFactorEnabled: false } });

    const clientData = encodeClientData("challenge-999");
    const passkeyResponse = {
      id: "cred-3",
      rawId: "cred-3",
      type: "public-key",
      response: {
        clientDataJSON: clientData,
        attestationObject: "attestation",
        transports: ["hybrid"],
      },
      clientExtensionResults: {},
    } as const;

    mockWebauthn.verifyWebAuthnRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "cred-3",
          publicKey: Buffer.from("public"),
          counter: 5,
        },
      },
    });

    mockTotp.generateRecoveryCodes.mockReturnValue(["code-1", "code-2"]);
    mockTotp.hashRecoveryCode.mockImplementation((code: string) => `hash-${code}`);

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn({
        update: () => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
      });
    });

    const response = await confirmPost(makeJsonRequest("http://localhost/api/2fa/webauthn/confirm", passkeyResponse));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.recoveryCodes).toEqual(["code-1", "code-2"]);
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith("user-1", "2fa_enabled");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith("user-1", "passkey_added");
  });
});
