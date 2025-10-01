// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { trustedDevice } from "@/drizzle/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import {
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  hashIpAddress,
  getTrustedDeviceExpiration,
} from "./totp";

export const TRUSTED_DEVICE_COOKIE_NAME = "__Host-trustedDevice";

/**
 * Create a new trusted device entry
 */
export async function createTrustedDevice(
  userId: string,
  userAgent: string | null,
  ip: string | null
): Promise<string> {
  const token = generateTrustedDeviceToken();
  const tokenHash = hashTrustedDeviceToken(token);
  const expiresAt = getTrustedDeviceExpiration(30);

  await db.insert(trustedDevice).values({
    userId,
    tokenHash,
    userAgent: userAgent ?? null,
    ipHash: ip ? hashIpAddress(ip) : null,
    expiresAt,
  });

  return token;
}

/**
 * Verify a trusted device token
 */
export async function verifyTrustedDevice(
  userId: string,
  token: string
): Promise<boolean> {
  const tokenHash = hashTrustedDeviceToken(token);
  const now = new Date();

  const [device] = await db
    .select()
    .from(trustedDevice)
    .where(
      and(
        eq(trustedDevice.userId, userId),
        eq(trustedDevice.tokenHash, tokenHash),
        isNull(trustedDevice.revokedAt),
        gt(trustedDevice.expiresAt, now)
      )
    )
    .limit(1);

  if (!device) {
    return false;
  }

  // Update last seen timestamp
  await db
    .update(trustedDevice)
    .set({ lastSeenAt: now })
    .where(eq(trustedDevice.id, device.id));

  return true;
}

/**
 * Revoke a specific trusted device
 */
export async function revokeTrustedDevice(deviceId: string): Promise<void> {
  await db
    .update(trustedDevice)
    .set({ revokedAt: new Date() })
    .where(eq(trustedDevice.id, deviceId));
}

/**
 * Revoke all trusted devices for a user
 */
export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  await db
    .update(trustedDevice)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(trustedDevice.userId, userId),
        isNull(trustedDevice.revokedAt)
      )
    );
}

/**
 * Get all trusted devices for a user
 */
export async function getTrustedDevices(userId: string) {
  const now = new Date();
  
  return db
    .select()
    .from(trustedDevice)
    .where(
      and(
        eq(trustedDevice.userId, userId),
        isNull(trustedDevice.revokedAt),
        gt(trustedDevice.expiresAt, now)
      )
    )
    .orderBy(trustedDevice.lastSeenAt);
}
