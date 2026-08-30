// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdmin2FA, requireRecentLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, users, ownerRecoveryCode } from "@/drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { verifyTotpCode, generateRecoveryCodes, hashRecoveryCode } from "@/lib/2fa/totp";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { z } from "zod";
import { createMfaSessionGrant, getMfaSessionContext } from "@/lib/2fa/session-grant";
import { decryptTotpSecret, protectTotpSecret } from "@/lib/2fa/totp-secret";
import { safeApiError } from "@/lib/api-error";

const confirmSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

class TotpEnrollmentConflictError extends Error {}

export async function POST(req: NextRequest) {
  try {
    let session = await requireAdmin();
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
    }
    const { userId } = context;
    const [account] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (account.twoFactorEnabled) {
      session = await requireAdmin2FA();
      if (!getMfaSessionContext(session)) {
        return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
      }
    } else requireRecentLogin(session);
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
    const step = verifyTotpCode(decryptTotpSecret(totp.secretBase32), code);
    if (step === null) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 400 }
      );
    }

    // Generate recovery codes
    const recoveryCodes = account.twoFactorEnabled ? [] : generateRecoveryCodes(10);
    const now = new Date();

    // Activate TOTP and enable 2FA
    await db.transaction(async (tx: any) => {
      // Activate TOTP
      const [activated] = await tx
        .update(ownerTotp)
        .set({
          activatedAt: now,
          lastUsedAt: now,
          lastUsedStep: step,
          secretBase32: protectTotpSecret(totp.secretBase32),
        })
        .where(and(
          eq(ownerTotp.userId, userId),
          eq(ownerTotp.secretBase32, totp.secretBase32),
          isNull(ownerTotp.activatedAt),
        ))
        .returning({ userId: ownerTotp.userId });
      if (!activated) throw new TotpEnrollmentConflictError();

      if (!account.twoFactorEnabled) {
        const [enabled] = await tx
          .update(users)
          .set({
            twoFactorEnabled: true,
            twoFactorEnforcedAt: now,
            mfaVerifiedAt: now,
          })
          .where(and(eq(users.id, userId), eq(users.twoFactorEnabled, false)))
          .returning({ id: users.id });
        if (!enabled) throw new TotpEnrollmentConflictError();
        await tx.insert(ownerRecoveryCode).values(
          recoveryCodes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) }))
        );
      }
    });

    if (!account.twoFactorEnabled) await createMfaSessionGrant(context);

    // Log activity
    if (!account.twoFactorEnabled) await logSecurityActivity(userId, "2fa_enabled");
    await logSecurityActivity(userId, "totp_activated");
    if (!account.twoFactorEnabled) {
      await logSecurityActivity(userId, "recovery_codes_generated", { count: recoveryCodes.length });
    }

    return NextResponse.json({
      success: true,
      recoveryCodes,
    });
  } catch (error) {
    console.error("Error confirming TOTP");
    if (error instanceof TotpEnrollmentConflictError) {
      return NextResponse.json({ error: "TOTP enrollment changed; restart setup" }, { status: 409 });
    }
    const publicError = safeApiError(error, "Failed to confirm TOTP");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
