// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, ownerWebAuthnCredential, ownerRecoveryCode } from "@/drizzle/schema";
import { eq, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const userId = (session.user as any).id;

    // Check TOTP status
    const [totp] = await db
      .select()
      .from(ownerTotp)
      .where(eq(ownerTotp.userId, userId))
      .limit(1);

    // Count WebAuthn credentials
    const webauthnCreds = await db
      .select()
      .from(ownerWebAuthnCredential)
      .where(eq(ownerWebAuthnCredential.userId, userId));

    // Count unused recovery codes
    const recoveryCodes = await db
      .select()
      .from(ownerRecoveryCode)
      .where(eq(ownerRecoveryCode.userId, userId));

    const unusedRecoveryCodes = recoveryCodes.filter((rc: any) => !rc.usedAt);

    return NextResponse.json({
      twoFactorEnabled: (session.user as any).twoFactorEnabled,
      totp: {
        enabled: Boolean(totp?.activatedAt),
        activatedAt: totp?.activatedAt,
      },
      webauthn: {
        count: webauthnCreds.length,
        credentials: webauthnCreds.map((cred: any) => ({
          id: cred.id,
          nickname: cred.nickname,
          createdAt: cred.createdAt,
          lastUsedAt: cred.lastUsedAt,
        })),
      },
      recoveryCodes: {
        total: recoveryCodes.length,
        unused: unusedRecoveryCodes.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching 2FA status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch 2FA status" },
      { status: 500 }
    );
  }
}
