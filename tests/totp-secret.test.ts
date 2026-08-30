// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  isEncryptedTotpSecret,
  protectTotpSecret,
} from "@/lib/2fa/totp-secret";

describe("TOTP secret envelope encryption", () => {
  const original = process.env.TOTP_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64url");
  });

  afterEach(() => {
    if (original === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = original;
  });

  it("round-trips an authenticated ciphertext with a random nonce", () => {
    const first = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    const second = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    expect(first).not.toBe(second);
    expect(isEncryptedTotpSecret(first)).toBe(true);
    expect(decryptTotpSecret(first)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("rejects ciphertext under the wrong key", () => {
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64url");
    expect(() => decryptTotpSecret(encrypted)).toThrow();
  });

  it("supports one-time migration of a legacy plaintext value", () => {
    expect(decryptTotpSecret("LEGACYSECRET")).toBe("LEGACYSECRET");
    expect(isEncryptedTotpSecret(protectTotpSecret("LEGACYSECRET"))).toBe(true);
  });

  it("fails closed when the key is missing", () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => encryptTotpSecret("SECRET")).toThrow(/not configured/);
  });
});
