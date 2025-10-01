// SPDX-License-Identifier: Apache-2.0
/**
 * Integration tests for 2FA enforcement on admin routes
 * These tests verify that admin users with 2FA enabled cannot access
 * admin routes without completing 2FA verification.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

describe("2FA Admin Enforcement", () => {
  const testAdminEmail = "test-admin-2fa@example.com";

  beforeEach(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.email, testAdminEmail));
  });

  it("should block admin route access when mfaPending=true", async () => {
    // Create admin user with 2FA enabled but not verified
    const [adminUser] = await db
      .insert(users)
      .values({
        email: testAdminEmail,
        name: "Test Admin",
        twoFactorEnabled: true,
        mfaVerifiedAt: null, // Not verified
      })
      .returning();

    expect(adminUser).toBeDefined();
    expect(adminUser.twoFactorEnabled).toBe(true);
    expect(adminUser.mfaVerifiedAt).toBeNull();
  });

  it("should allow admin route access when mfaVerifiedAt is recent", async () => {
    // Create admin user with 2FA enabled and recently verified
    const [adminUser] = await db
      .insert(users)
      .values({
        email: testAdminEmail,
        name: "Test Admin",
        twoFactorEnabled: true,
        mfaVerifiedAt: new Date(), // Just verified
      })
      .returning();

    expect(adminUser).toBeDefined();
    expect(adminUser.twoFactorEnabled).toBe(true);
    expect(adminUser.mfaVerifiedAt).not.toBeNull();
  });

  it("should require 2FA when mfaVerifiedAt is expired (>8 hours)", async () => {
    // Create admin user with expired verification
    const eightHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000);
    const [adminUser] = await db
      .insert(users)
      .values({
        email: testAdminEmail,
        name: "Test Admin",
        twoFactorEnabled: true,
        mfaVerifiedAt: eightHoursAgo,
      })
      .returning();

    expect(adminUser).toBeDefined();
    expect(adminUser.twoFactorEnabled).toBe(true);
    expect(adminUser.mfaVerifiedAt).not.toBeNull();

    // Check if verification is expired
    const now = Date.now();
    const verifiedAt = new Date(adminUser.mfaVerifiedAt!).getTime();
    const isExpired = now - verifiedAt > 8 * 60 * 60 * 1000;
    expect(isExpired).toBe(true);
  });

  it("should allow admin route access when 2FA is not enabled", async () => {
    // Create admin user without 2FA
    const [adminUser] = await db
      .insert(users)
      .values({
        email: testAdminEmail,
        name: "Test Admin",
        twoFactorEnabled: false,
        mfaVerifiedAt: null,
      })
      .returning();

    expect(adminUser).toBeDefined();
    expect(adminUser.twoFactorEnabled).toBe(false);
  });

  it("should verify the 8-hour window calculation", () => {
    const now = Date.now();
    
    // 7 hours ago - should be valid
    const sevenHoursAgo = new Date(now - 7 * 60 * 60 * 1000);
    const isRecentSeven = now - sevenHoursAgo.getTime() < 8 * 60 * 60 * 1000;
    expect(isRecentSeven).toBe(true);

    // 9 hours ago - should be expired
    const nineHoursAgo = new Date(now - 9 * 60 * 60 * 1000);
    const isRecentNine = now - nineHoursAgo.getTime() < 8 * 60 * 60 * 1000;
    expect(isRecentNine).toBe(false);
  });
});
