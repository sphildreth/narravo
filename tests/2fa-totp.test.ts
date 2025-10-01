// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  isTotpCodeValid,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  hashIpAddress,
  getTrustedDeviceExpiration,
} from "@/lib/2fa/totp";
import { authenticator } from "otplib";

describe("2FA TOTP", () => {
  describe("generateTotpSecret", () => {
    it("should generate a valid Base32 secret", () => {
      const secret = generateTotpSecret();
      expect(secret).toBeTruthy();
      expect(typeof secret).toBe("string");
      expect(secret.length).toBeGreaterThan(0);
      // Base32 alphabet check
      expect(/^[A-Z2-7]+=*$/.test(secret)).toBe(true);
    });
  });

  describe("generateTotpUri", () => {
    it("should generate a valid otpauth URI", () => {
      const secret = generateTotpSecret();
      const uri = generateTotpUri(secret, "test@example.com", "TestApp");
      
      expect(uri).toContain("otpauth://totp/");
      expect(uri).toContain("TestApp:test%40example.com"); // @ is URL encoded
      expect(uri).toContain(`secret=${secret}`);
    });

    it("should use default issuer if not provided", () => {
      const secret = generateTotpSecret();
      const uri = generateTotpUri(secret, "test@example.com");
      
      expect(uri).toContain("otpauth://totp/");
      expect(uri).toContain("Narravo");
    });
  });

  describe("verifyTotpCode", () => {
    it("should verify a valid TOTP code", () => {
      const secret = generateTotpSecret();
      const code = authenticator.generate(secret);
      
      const step = verifyTotpCode(secret, code);
      expect(step).not.toBeNull();
      expect(typeof step).toBe("number");
    });

    it("should reject an invalid code", () => {
      const secret = generateTotpSecret();
      const invalidCode = "000000";
      
      const step = verifyTotpCode(secret, invalidCode);
      expect(step).toBeNull();
    });

    it("should return the current step number", () => {
      const secret = generateTotpSecret();
      const code = authenticator.generate(secret);
      
      const step = verifyTotpCode(secret, code);
      const expectedStep = Math.floor(Date.now() / 1000 / 30);
      
      expect(step).toBeCloseTo(expectedStep, 1);
    });
  });

  describe("isTotpCodeValid", () => {
    it("should validate a correct TOTP code", () => {
      const secret = generateTotpSecret();
      const code = authenticator.generate(secret);
      
      expect(isTotpCodeValid(secret, code)).toBe(true);
    });

    it("should reject an incorrect TOTP code", () => {
      const secret = generateTotpSecret();
      expect(isTotpCodeValid(secret, "000000")).toBe(false);
    });
  });

  describe("generateRecoveryCodes", () => {
    it("should generate the specified number of codes", () => {
      const codes = generateRecoveryCodes(10);
      expect(codes).toHaveLength(10);
    });

    it("should generate codes in the correct format", () => {
      const codes = generateRecoveryCodes(5);
      
      codes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });
    });

    it("should generate unique codes", () => {
      const codes = generateRecoveryCodes(10);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe("hashRecoveryCode", () => {
    it("should hash a recovery code", () => {
      const code = "1234-5678";
      const hash = hashRecoveryCode(code);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA-256 hex
    });

    it("should produce consistent hashes", () => {
      const code = "1234-5678";
      const hash1 = hashRecoveryCode(code);
      const hash2 = hashRecoveryCode(code);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe("verifyRecoveryCode", () => {
    it("should verify a valid recovery code", () => {
      const code = "1234-5678";
      const hash = hashRecoveryCode(code);
      
      expect(verifyRecoveryCode(code, hash)).toBe(true);
    });

    it("should reject an invalid recovery code", () => {
      const code = "1234-5678";
      const hash = hashRecoveryCode(code);
      
      expect(verifyRecoveryCode("9999-9999", hash)).toBe(false);
    });
  });

  describe("generateTrustedDeviceToken", () => {
    it("should generate a secure random token", () => {
      const token = generateTrustedDeviceToken();
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes in hex
    });

    it("should generate unique tokens", () => {
      const token1 = generateTrustedDeviceToken();
      const token2 = generateTrustedDeviceToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe("hashTrustedDeviceToken", () => {
    it("should hash a token", () => {
      const token = generateTrustedDeviceToken();
      const hash = hashTrustedDeviceToken(token);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA-256 hex
    });
  });

  describe("hashIpAddress", () => {
    it("should hash an IP address", () => {
      const ip = "192.168.1.1";
      const hash = hashIpAddress(ip);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(16); // First 8 bytes in hex
    });

    it("should produce consistent hashes", () => {
      const ip = "192.168.1.1";
      const hash1 = hashIpAddress(ip);
      const hash2 = hashIpAddress(ip);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe("getTrustedDeviceExpiration", () => {
    it("should calculate expiration date", () => {
      const expiration = getTrustedDeviceExpiration(30);
      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setDate(expectedDate.getDate() + 30);
      
      expect(expiration.getTime()).toBeCloseTo(expectedDate.getTime(), -4); // Within ~10 seconds
    });

    it("should use default 30 days if not specified", () => {
      const expiration = getTrustedDeviceExpiration();
      const now = new Date();
      const thirtyDaysLater = new Date(now);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      
      expect(expiration.getTime()).toBeCloseTo(thirtyDaysLater.getTime(), -4);
    });
  });
});
