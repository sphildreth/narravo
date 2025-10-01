// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, users, ownerRecoveryCode } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyTotpCode, generateRecoveryCodes, hashRecoveryCode } from "@/lib/2fa/totp";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { z } from "zod";

const confirmSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const userId = (session.user as any).id;
    const body = await req.json();
    
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid code format" },
        { status: 400 }
      );
    }

    const { code } = parsed.data;

    // Get pending TOTP secret
    const [totp] = await db
      .select()
      .from(ownerTotp)
      .where(eq(ownerTotp.userId, userId))
      .limit(1);

    if (!totp) {
      return NextResponse.json(
        { error: "TOTP not initialized" },
        { status: 400 }
      );
    }

    if (totp.activatedAt) {
      return NextResponse.json(
        { error: "TOTP is already activated" },
        { status: 400 }
      );
    }

    // Verify the code
    const step = verifyTotpCode(totp.secretBase32, code);
    if (!step) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 400 }
      );
    }

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(10);
    const now = new Date();

    // Activate TOTP and enable 2FA
    await db.transaction(async (tx: any) => {
      // Activate TOTP
      await tx
        .update(ownerTotp)
        .set({
          activatedAt: now,
          lastUsedAt: now,
          lastUsedStep: step,
        })
        .where(eq(ownerTotp.userId, userId));

      // Enable 2FA on user
      await tx
        .update(users)
        .set({
          twoFactorEnabled: true,
          twoFactorEnforcedAt: now,
          mfaVerifiedAt: now, // Mark as verified since user just confirmed TOTP
        })
        .where(eq(users.id, userId));

      // Store recovery codes (hashed)
      await tx.insert(ownerRecoveryCode).values(
        recoveryCodes.map((code) => ({
          userId,
          codeHash: hashRecoveryCode(code),
        }))
      );
    });

    // Log activity
    await logSecurityActivity(userId, "2fa_enabled");
    await logSecurityActivity(userId, "totp_activated");
    await logSecurityActivity(userId, "recovery_codes_generated", {
      count: recoveryCodes.length,
    });

    return NextResponse.json({
      success: true,
      recoveryCodes,
    });
  } catch (error: any) {
    console.error("Error confirming TOTP:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm TOTP" },
      { status: 500 }
    );
  }
}
