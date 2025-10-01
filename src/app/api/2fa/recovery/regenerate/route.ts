// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerRecoveryCode } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/2fa/totp";
import { logSecurityActivity } from "@/lib/2fa/security-activity";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const userId = (session.user as any).id;

    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes(10);

    await db.transaction(async (tx: any) => {
      // Delete old recovery codes
      await tx
        .delete(ownerRecoveryCode)
        .where(eq(ownerRecoveryCode.userId, userId));

      // Insert new recovery codes
      await tx.insert(ownerRecoveryCode).values(
        recoveryCodes.map((code) => ({
          userId,
          codeHash: hashRecoveryCode(code),
        }))
      );
    });

    // Log activity
    await logSecurityActivity(userId, "recovery_codes_generated", {
      count: recoveryCodes.length,
    });

    return NextResponse.json({
      success: true,
      recoveryCodes,
    });
  } catch (error: any) {
    console.error("Error regenerating recovery codes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to regenerate recovery codes" },
      { status: 500 }
    );
  }
}
