// SPDX-License-Identifier: Apache-2.0
/**
 * Clear MFA verification timestamp for testing
 * Usage: pnpm tsx scripts/clear-mfa-verification.ts <email>
 */
import { db } from "../src/lib/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm tsx scripts/clear-mfa-verification.ts <email>");
  process.exit(1);
}

async function clearMfaVerification() {
  try {
    const result = await db
      .update(users)
      .set({ mfaVerifiedAt: null })
      .where(eq(users.email, email!))
      .returning({ email: users.email, twoFactorEnabled: users.twoFactorEnabled });

    if (result.length === 0) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Cleared mfaVerifiedAt for ${result[0].email}`);
    console.log(`   2FA Enabled: ${result[0].twoFactorEnabled}`);
    console.log("\nNow log out and log back in to test the 2FA prompt.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

clearMfaVerification();
