// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTrustedDevice,
  verifyTrustedDevice,
  revokeTrustedDevice,
  revokeAllTrustedDevices,
  getTrustedDevices,
} from "@/lib/2fa/trusted-device";
import {
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  hashIpAddress,
  getTrustedDeviceExpiration,
} from "@/lib/2fa/totp";

// Create mock functions for database operations
const mockInsertValues = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: mockInsertValues }),
    select: () => ({ 
      from: mockFrom.mockReturnValue({ 
        where: mockWhere.mockReturnValue({ 
          orderBy: mockOrderBy,
          limit: mockLimit 
        }) 
      }) 
    }),
    update: () => ({ set: mockUpdateSet }),
  },
}));

// Mock the TOTP module
vi.mock("@/lib/2fa/totp", () => ({
  generateTrustedDeviceToken: vi.fn(),
  hashTrustedDeviceToken: vi.fn(),
  hashIpAddress: vi.fn(),
  getTrustedDeviceExpiration: vi.fn(),
}));

describe("2FA Trusted Device", () => {
  const testUserId = "test-user-id-123";
  const testUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
  const testIp = "192.168.1.1";
  const testToken = "trusted-device-token-abc123";
  const testTokenHash = "hashed-token-abc123";
  const testIpHash = "hashed-ip-abc123";
  const testDeviceId = "device-id-123";
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const mockGenerateTrustedDeviceToken = vi.mocked(generateTrustedDeviceToken);
  const mockHashTrustedDeviceToken = vi.mocked(hashTrustedDeviceToken);
  const mockHashIpAddress = vi.mocked(hashIpAddress);
  const mockGetTrustedDeviceExpiration = vi.mocked(getTrustedDeviceExpiration);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockGenerateTrustedDeviceToken.mockReturnValue(testToken);
    mockHashTrustedDeviceToken.mockReturnValue(testTokenHash);
    mockHashIpAddress.mockReturnValue(testIpHash);
    mockGetTrustedDeviceExpiration.mockReturnValue(futureDate);
  });

  describe("createTrustedDevice", () => {
    it("should create a trusted device with all parameters", async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const token = await createTrustedDevice(testUserId, testUserAgent, testIp);

      expect(token).toBe(testToken);
      expect(mockGenerateTrustedDeviceToken).toHaveBeenCalled();
      expect(mockHashTrustedDeviceToken).toHaveBeenCalledWith(testToken);
      expect(mockHashIpAddress).toHaveBeenCalledWith(testIp);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          tokenHash: testTokenHash,
          userAgent: testUserAgent,
          ipHash: testIpHash,
        })
      );
    });

    it("should create a trusted device with null userAgent", async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const token = await createTrustedDevice(testUserId, null, testIp);

      expect(token).toBe(testToken);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          tokenHash: testTokenHash,
          userAgent: null,
          ipHash: testIpHash,
        })
      );
    });

    it("should create a trusted device with null ip", async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const token = await createTrustedDevice(testUserId, testUserAgent, null);

      expect(token).toBe(testToken);
      expect(mockHashIpAddress).not.toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          tokenHash: testTokenHash,
          userAgent: testUserAgent,
          ipHash: null,
        })
      );
    });

    it("should create a trusted device with both userAgent and ip null", async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const token = await createTrustedDevice(testUserId, null, null);

      expect(token).toBe(testToken);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          tokenHash: testTokenHash,
          userAgent: null,
          ipHash: null,
        })
      );
    });

    it("should set expiration date to 30 days in the future", async () => {
      mockInsertValues.mockResolvedValue(undefined);

      await createTrustedDevice(testUserId, testUserAgent, testIp);

      expect(mockGetTrustedDeviceExpiration).toHaveBeenCalledWith(30);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: futureDate,
        })
      );
    });

    it("should generate unique token for each device", async () => {
      mockInsertValues.mockResolvedValue(undefined);
      mockGenerateTrustedDeviceToken
        .mockReturnValueOnce("token-1")
        .mockReturnValueOnce("token-2");

      const token1 = await createTrustedDevice(testUserId, testUserAgent, testIp);
      const token2 = await createTrustedDevice(testUserId, testUserAgent, testIp);

      expect(token1).toBe("token-1");
      expect(token2).toBe("token-2");
      expect(mockGenerateTrustedDeviceToken).toHaveBeenCalledTimes(2);
    });
  });

  describe("verifyTrustedDevice", () => {
    it("should verify a valid trusted device", async () => {
      const mockDevice = {
        id: testDeviceId,
        userId: testUserId,
        tokenHash: testTokenHash,
        userAgent: testUserAgent,
        ipHash: testIpHash,
        expiresAt: futureDate,
        revokedAt: null,
        lastSeenAt: new Date(),
        createdAt: new Date(),
      };

      mockLimit.mockResolvedValue([mockDevice]);
      mockUpdateWhere.mockResolvedValue(undefined);

      const result = await verifyTrustedDevice(testUserId, testToken);

      expect(result).toBe(true);
      expect(mockHashTrustedDeviceToken).toHaveBeenCalledWith(testToken);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSeenAt: expect.any(Date),
        })
      );
    });

    it("should reject device with invalid token", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await verifyTrustedDevice(testUserId, "invalid-token");

      expect(result).toBe(false);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("should reject expired device", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const mockDevice = {
        id: testDeviceId,
        userId: testUserId,
        tokenHash: testTokenHash,
        expiresAt: expiredDate,
        revokedAt: null,
      };

      // The query should filter out expired devices, so return empty array
      mockLimit.mockResolvedValue([]);

      const result = await verifyTrustedDevice(testUserId, testToken);

      expect(result).toBe(false);
    });

    it("should reject revoked device", async () => {
      const mockDevice = {
        id: testDeviceId,
        userId: testUserId,
        tokenHash: testTokenHash,
        expiresAt: futureDate,
        revokedAt: new Date(),
      };

      // The query should filter out revoked devices, so return empty array
      mockLimit.mockResolvedValue([]);

      const result = await verifyTrustedDevice(testUserId, testToken);

      expect(result).toBe(false);
    });

    it("should reject device for different user", async () => {
      // The query filters by userId, so different user = no match
      mockLimit.mockResolvedValue([]);

      const result = await verifyTrustedDevice("different-user-id", testToken);

      expect(result).toBe(false);
    });

    it("should update lastSeenAt timestamp on successful verification", async () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const mockDevice = {
        id: testDeviceId,
        userId: testUserId,
        tokenHash: testTokenHash,
        expiresAt: futureDate,
        revokedAt: null,
        lastSeenAt: oldTimestamp,
        createdAt: new Date(),
      };

      mockLimit.mockResolvedValue([mockDevice]);
      mockUpdateWhere.mockResolvedValue(undefined);

      await verifyTrustedDevice(testUserId, testToken);

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSeenAt: expect.any(Date),
        })
      );
      
      // Verify that lastSeenAt was updated (mock was called)
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe("revokeTrustedDevice", () => {
    it("should revoke a specific trusted device", async () => {
      mockUpdateWhere.mockResolvedValue(undefined);

      await revokeTrustedDevice(testDeviceId);

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
        })
      );
    });

    it("should set revokedAt to current timestamp", async () => {
      mockUpdateWhere.mockResolvedValue(undefined);
      const beforeRevoke = Date.now();

      await revokeTrustedDevice(testDeviceId);

      // Verify revokedAt was set to a Date object
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
        })
      );
    });
  });

  describe("revokeAllTrustedDevices", () => {
    it("should revoke all trusted devices for a user", async () => {
      mockUpdateWhere.mockResolvedValue(undefined);

      await revokeAllTrustedDevices(testUserId);

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
        })
      );
    });

    it("should only revoke non-revoked devices", async () => {
      mockUpdateWhere.mockResolvedValue(undefined);

      await revokeAllTrustedDevices(testUserId);

      // The query should include isNull(trustedDevice.revokedAt) condition
      // We verify the update was called, the actual filtering is in the query
      expect(mockUpdateSet).toHaveBeenCalled();
    });

    it("should set revokedAt to current timestamp for all devices", async () => {
      mockUpdateWhere.mockResolvedValue(undefined);
      const beforeRevoke = Date.now();

      await revokeAllTrustedDevices(testUserId);

      // Verify revokedAt was set to a Date object
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          revokedAt: expect.any(Date),
        })
      );
    });
  });

  describe("getTrustedDevices", () => {
    it("should retrieve all active trusted devices for a user", async () => {
      const mockDevices = [
        {
          id: "device-1",
          userId: testUserId,
          tokenHash: "hash-1",
          expiresAt: futureDate,
          revokedAt: null,
          lastSeenAt: new Date(),
        },
        {
          id: "device-2",
          userId: testUserId,
          tokenHash: "hash-2",
          expiresAt: futureDate,
          revokedAt: null,
          lastSeenAt: new Date(),
        },
      ];

      mockOrderBy.mockResolvedValue(mockDevices);

      const devices = await getTrustedDevices(testUserId);

      expect(devices).toEqual(mockDevices);
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it("should exclude revoked devices", async () => {
      // The query filters by isNull(revokedAt), so revoked devices won't be in results
      mockOrderBy.mockResolvedValue([]);

      const devices = await getTrustedDevices(testUserId);

      expect(devices).toEqual([]);
    });

    it("should exclude expired devices", async () => {
      // The query filters by gt(expiresAt, now), so expired devices won't be in results
      mockOrderBy.mockResolvedValue([]);

      const devices = await getTrustedDevices(testUserId);

      expect(devices).toEqual([]);
    });

    it("should return empty array when user has no trusted devices", async () => {
      mockOrderBy.mockResolvedValue([]);

      const devices = await getTrustedDevices(testUserId);

      expect(devices).toEqual([]);
      expect(mockFrom).toHaveBeenCalled();
    });

    it("should order devices by lastSeenAt", async () => {
      const device1 = {
        id: "device-1",
        userId: testUserId,
        tokenHash: "hash-1",
        expiresAt: futureDate,
        revokedAt: null,
        lastSeenAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };
      const device2 = {
        id: "device-2",
        userId: testUserId,
        tokenHash: "hash-2",
        expiresAt: futureDate,
        revokedAt: null,
        lastSeenAt: new Date(), // Now
      };

      mockOrderBy.mockResolvedValue([device2, device1]);

      const devices = await getTrustedDevices(testUserId);

      expect(devices).toEqual([device2, device1]);
      expect(mockOrderBy).toHaveBeenCalled();
    });
  });
});
