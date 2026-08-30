// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, ownerWebAuthnCredential, ownerRecoveryCode } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyWebAuthnRegistration } from "@/lib/2fa/webauthn";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/2fa/totp";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { createMfaSessionGrant, getMfaSessionContext } from "@/lib/2fa/session-grant";
import { consumeWebAuthnChallenge, extractClientDataChallenge } from "@/lib/2fa/webauthn-challenge";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
    }
    const { userId } = context;
    const twoFactorEnabled = (session.user as any).twoFactorEnabled;

    // This endpoint is only for initial 2FA setup via passkey
    if (twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Use /api/2fa/webauthn/register/verify to add additional passkeys." },
        { status: 400 }
      );
    }

    const body: RegistrationResponseJSON = await req.json();
    const responseChallenge = extractClientDataChallenge(body.response.clientDataJSON);
    if (!responseChallenge) {
      return NextResponse.json({ error: "Invalid WebAuthn challenge" }, { status: 400 });
    }

    const challenge = await consumeWebAuthnChallenge({
      userId,
      sessionId: context.sessionId,
      ceremony: "registration",
      responseChallenge,
    });
    if (!challenge) {
      return NextResponse.json({ error: "WebAuthn challenge is missing, expired, consumed, or bound to another session" }, { status: 400 });
    }

    // Verify the registration
    const verification = await verifyWebAuthnRegistration(body, challenge.challenge);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Failed to verify passkey registration" },
        { status: 400 }
      );
    }

    const { credential } = verification.registrationInfo;

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(10);
    const now = new Date();

    // Enable 2FA and store the passkey
    await db.transaction(async (tx: any) => {
      // Enable 2FA on user
      await tx
        .update(users)
        .set({
          twoFactorEnabled: true,
          twoFactorEnforcedAt: now,
          mfaVerifiedAt: now, // Mark as verified since user just registered passkey
        })
        .where(eq(users.id, userId));

      // Store the WebAuthn credential
      await tx.insert(ownerWebAuthnCredential).values({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        transports: body.response.transports ?? [],
        nickname: (body as any).nickname ?? null,
      });

      // Store recovery codes (hashed)
      await tx.insert(ownerRecoveryCode).values(
        recoveryCodes.map((code) => ({
          userId,
          codeHash: hashRecoveryCode(code),
        }))
      );
    });

    // Initial passkey enrollment is also a successful second factor for this
    // exact session. The normal JWT update callback consumes this grant.
    await createMfaSessionGrant(context);

    // Log activity
    await logSecurityActivity(userId, "2fa_enabled");
    await logSecurityActivity(userId, "passkey_added");
    await logSecurityActivity(userId, "recovery_codes_generated", {
      count: recoveryCodes.length,
    });

    return NextResponse.json({
      success: true,
      recoveryCodes,
    });
  } catch (error: any) {
    console.error("Error confirming passkey registration");
    return NextResponse.json(
      { error: error.message || "Failed to enable 2FA with passkey" },
      { status: 500 }
    );
  }
}
