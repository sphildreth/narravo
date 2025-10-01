// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { securityActivity } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";

export type SecurityEvent =
  | "2fa_enabled"
  | "2fa_disabled"
  | "totp_activated"
  | "passkey_added"
  | "passkey_removed"
  | "recovery_codes_generated"
  | "recovery_code_used"
  | "trusted_device_added"
  | "trusted_device_revoked"
  | "all_trusted_devices_revoked";

/**
 * Log a security activity event
 */
export async function logSecurityActivity(
  userId: string,
  event: SecurityEvent,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.insert(securityActivity).values({
      userId,
      event,
      metadata: metadata ?? null,
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error("Failed to log security activity:", error);
  }
}

/**
 * Get recent security activities for a user
 */
export async function getSecurityActivities(userId: string, limit: number = 50) {
  return db
    .select()
    .from(securityActivity)
    .where(eq(securityActivity.userId, userId))
    .orderBy(desc(securityActivity.timestamp))
    .limit(limit);
}
