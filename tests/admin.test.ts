// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseAdminAllowlist, isEmailAdmin } from "@/lib/admin";

describe("admin.ts utilities", () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_EMAILS = originalEnv;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  describe("parseAdminAllowlist", () => {
    it("should parse comma-separated email list", () => {
      const input = "admin@example.com,owner@test.com,boss@company.com";
      const result = parseAdminAllowlist(input);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has("admin@example.com")).toBe(true);
      expect(result.has("owner@test.com")).toBe(true);
      expect(result.has("boss@company.com")).toBe(true);
    });

    it("should normalize email addresses to lowercase", () => {
      const input = "Admin@Example.COM,OWNER@TEST.com";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(2);
      expect(result.has("admin@example.com")).toBe(true);
      expect(result.has("owner@test.com")).toBe(true);
      // Original case should not be present
      expect(result.has("Admin@Example.COM")).toBe(false);
      expect(result.has("OWNER@TEST.com")).toBe(false);
    });

    it("should trim whitespace from email addresses", () => {
      const input = "  admin@example.com  ,  owner@test.com  , boss@company.com ";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(3);
      expect(result.has("admin@example.com")).toBe(true);
      expect(result.has("owner@test.com")).toBe(true);
      expect(result.has("boss@company.com")).toBe(true);
    });

    it("should handle undefined input by returning empty Set", () => {
      const result = parseAdminAllowlist(undefined);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should handle empty string by returning empty Set", () => {
      const result = parseAdminAllowlist("");

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should filter out empty entries", () => {
      const input = "admin@example.com,,owner@test.com,,,boss@company.com";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(3);
      expect(result.has("admin@example.com")).toBe(true);
      expect(result.has("owner@test.com")).toBe(true);
      expect(result.has("boss@company.com")).toBe(true);
    });

    it("should filter out whitespace-only entries", () => {
      const input = "admin@example.com,   ,owner@test.com,  \t  ";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(2);
      expect(result.has("admin@example.com")).toBe(true);
      expect(result.has("owner@test.com")).toBe(true);
    });

    it("should handle single email address", () => {
      const input = "admin@example.com";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(1);
      expect(result.has("admin@example.com")).toBe(true);
    });

    it("should deduplicate email addresses", () => {
      const input = "admin@example.com,owner@test.com,admin@example.com";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(2);
      expect(result.has("admin@example.com")).toBe(true);
      expect(result.has("owner@test.com")).toBe(true);
    });

    it("should deduplicate after normalization", () => {
      const input = "Admin@Example.com,admin@EXAMPLE.COM,ADMIN@example.com";
      const result = parseAdminAllowlist(input);

      expect(result.size).toBe(1);
      expect(result.has("admin@example.com")).toBe(true);
    });
  });

  describe("isEmailAdmin", () => {
    it("should return true for admin email in allowlist", () => {
      const allowlist = "admin@example.com,owner@test.com";
      const result = isEmailAdmin("admin@example.com", allowlist);

      expect(result).toBe(true);
    });

    it("should return false for non-admin email", () => {
      const allowlist = "admin@example.com,owner@test.com";
      const result = isEmailAdmin("user@example.com", allowlist);

      expect(result).toBe(false);
    });

    it("should be case-insensitive", () => {
      const allowlist = "admin@example.com";
      
      expect(isEmailAdmin("Admin@Example.com", allowlist)).toBe(true);
      expect(isEmailAdmin("ADMIN@EXAMPLE.COM", allowlist)).toBe(true);
      expect(isEmailAdmin("admin@EXAMPLE.com", allowlist)).toBe(true);
    });

    it("should handle whitespace in email being checked", () => {
      const allowlist = "admin@example.com";
      
      expect(isEmailAdmin("  admin@example.com  ", allowlist)).toBe(true);
      expect(isEmailAdmin("\tadmin@example.com\t", allowlist)).toBe(true);
    });

    it("should return false for null email", () => {
      const allowlist = "admin@example.com";
      const result = isEmailAdmin(null, allowlist);

      expect(result).toBe(false);
    });

    it("should return false for undefined email", () => {
      const allowlist = "admin@example.com";
      const result = isEmailAdmin(undefined, allowlist);

      expect(result).toBe(false);
    });

    it("should return false for empty string email", () => {
      const allowlist = "admin@example.com";
      const result = isEmailAdmin("", allowlist);

      expect(result).toBe(false);
    });

    it("should return false for whitespace-only email", () => {
      const allowlist = "admin@example.com";
      
      expect(isEmailAdmin("   ", allowlist)).toBe(false);
      expect(isEmailAdmin("\t\n", allowlist)).toBe(false);
    });

    it("should return false when allowlist is empty", () => {
      const result = isEmailAdmin("admin@example.com", "");

      expect(result).toBe(false);
    });

    it("should return false when allowlist is undefined", () => {
      const result = isEmailAdmin("admin@example.com", undefined);

      expect(result).toBe(false);
    });

    it("should use process.env.ADMIN_EMAILS by default", () => {
      process.env.ADMIN_EMAILS = "admin@example.com,owner@test.com";
      
      expect(isEmailAdmin("admin@example.com")).toBe(true);
      expect(isEmailAdmin("owner@test.com")).toBe(true);
      expect(isEmailAdmin("user@example.com")).toBe(false);
    });

    it("should override process.env.ADMIN_EMAILS when raw parameter provided", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const customAllowlist = "owner@test.com";
      
      expect(isEmailAdmin("owner@test.com", customAllowlist)).toBe(true);
      expect(isEmailAdmin("admin@example.com", customAllowlist)).toBe(false);
    });

    it("should handle complex email addresses", () => {
      const allowlist = "user+tag@example.com,admin.user@sub.example.com";
      
      expect(isEmailAdmin("user+tag@example.com", allowlist)).toBe(true);
      expect(isEmailAdmin("admin.user@sub.example.com", allowlist)).toBe(true);
    });

    it("should match exact emails only (no partial matching)", () => {
      const allowlist = "admin@example.com";
      
      expect(isEmailAdmin("admin@example.com.evil.com", allowlist)).toBe(false);
      expect(isEmailAdmin("notadmin@example.com", allowlist)).toBe(false);
      expect(isEmailAdmin("admin@example.co", allowlist)).toBe(false);
    });
  });
});
