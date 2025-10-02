// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logSecurityActivity, getSecurityActivities } from "@/lib/2fa/security-activity";
import type { SecurityEvent } from "@/lib/2fa/security-activity";

// Create mock functions for database operations
const mockInsertValues = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: mockInsertValues }),
    select: () => ({ from: mockFrom }),
  },
}));

describe("2FA Security Activity", () => {
  const testUserId = "test-user-id-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("logSecurityActivity", () => {
    it("should log a security activity event successfully", async () => {
      mockInsertValues.mockResolvedValue(undefined);

      await logSecurityActivity(testUserId, "2fa_enabled");

      expect(mockInsertValues).toHaveBeenCalledWith({
        userId: testUserId,
        event: "2fa_enabled",
        metadata: null,
      });
    });

    it("should log event with metadata", async () => {
      const metadata = { device: "iPhone", browser: "Safari" };
      mockInsertValues.mockResolvedValue(undefined);

      await logSecurityActivity(testUserId, "passkey_added", metadata);

      expect(mockInsertValues).toHaveBeenCalledWith({
        userId: testUserId,
        event: "passkey_added",
        metadata,
      });
    });

    it("should handle database errors gracefully without throwing", async () => {
      const dbError = new Error("Database connection failed");
      mockInsertValues.mockRejectedValue(dbError);

      await expect(
        logSecurityActivity(testUserId, "2fa_enabled")
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        "Failed to log security activity:",
        dbError
      );
    });

    it("should log all SecurityEvent types", async () => {
      const events: SecurityEvent[] = [
        "2fa_enabled",
        "2fa_disabled",
        "totp_activated",
        "passkey_added",
        "passkey_removed",
        "recovery_codes_generated",
        "recovery_code_used",
        "trusted_device_added",
        "trusted_device_revoked",
        "all_trusted_devices_revoked",
      ];

      mockInsertValues.mockResolvedValue(undefined);

      for (const event of events) {
        await logSecurityActivity(testUserId, event);
        expect(mockInsertValues).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: testUserId,
            event,
          })
        );
      }
    });
  });

  describe("getSecurityActivities", () => {
    it("should retrieve security activities with default limit", async () => {
      const mockActivities = [
        {
          id: "activity-1",
          userId: testUserId,
          event: "2fa_enabled" as SecurityEvent,
          metadata: null,
          timestamp: new Date("2025-10-01T10:00:00Z"),
        },
      ];

      mockLimit.mockResolvedValue(mockActivities);

      const result = await getSecurityActivities(testUserId);

      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockActivities);
    });

    it("should retrieve security activities with custom limit", async () => {
      const mockActivities = [
        {
          id: "activity-1",
          userId: testUserId,
          event: "2fa_enabled" as SecurityEvent,
          metadata: null,
          timestamp: new Date("2025-10-01T10:00:00Z"),
        },
      ];

      mockLimit.mockResolvedValue(mockActivities);

      const result = await getSecurityActivities(testUserId, 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockActivities);
    });

    it("should return empty array when user has no activities", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await getSecurityActivities(testUserId);

      expect(result).toEqual([]);
    });
  });
});
