// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, ownerTotp, ownerWebAuthnCredential, ownerRecoveryCode } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { revokeAllTrustedDevices } from "@/lib/2fa/trusted-device";
import { logSecurityActivity } from "@/lib/2fa/security-activity";

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const userId = (session.user as any).id;

    await db.transaction(async (tx: any) => {
      // Disable 2FA on user
      await tx
        .update(users)
        .set({
          twoFactorEnabled: false,
          twoFactorEnforcedAt: null,
        })
        .where(eq(users.id, userId));

      // Delete TOTP config
      await tx
        .delete(ownerTotp)
        .where(eq(ownerTotp.userId, userId));

      // Delete WebAuthn credentials
      await tx
        .delete(ownerWebAuthnCredential)
        .where(eq(ownerWebAuthnCredential.userId, userId));

      // Delete recovery codes
      await tx
        .delete(ownerRecoveryCode)
        .where(eq(ownerRecoveryCode.userId, userId));
    });

    // Revoke all trusted devices
    await revokeAllTrustedDevices(userId);

    // Log activity
    await logSecurityActivity(userId, "2fa_disabled");

    return NextResponse.json({
      success: true,
      message: "2FA has been disabled",
    });
  } catch (error: any) {
    console.error("Error disabling 2FA:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disable 2FA" },
      { status: 500 }
    );
  }
}
