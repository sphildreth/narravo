// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireRecentLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, ownerWebAuthnCredential, ownerRecoveryCode } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { verifyWebAuthnRegistration } from "@/lib/2fa/webauthn";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/2fa/totp";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { createMfaSessionGrant, getMfaSessionContext } from "@/lib/2fa/session-grant";
import { consumePendingWebAuthnChallenge, extractClientDataChallenge, getPendingWebAuthnChallenge } from "@/lib/2fa/webauthn-challenge";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { safeApiError } from "@/lib/api-error";

class PasskeyEnrollmentConflictError extends Error {}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
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

    // This endpoint is only for initial 2FA setup via passkey
    if (account.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Use /api/2fa/webauthn/register/verify to add additional passkeys." },
        { status: 400 }
      );
    }
    requireRecentLogin(session);

    const body: RegistrationResponseJSON = await req.json();
    const responseChallenge = extractClientDataChallenge(body.response.clientDataJSON);
    if (!responseChallenge) {
      return NextResponse.json({ error: "Invalid WebAuthn challenge" }, { status: 400 });
    }

    const challengeContext = {
      userId,
      sessionId: context.sessionId,
      ceremony: "registration" as const,
      responseChallenge,
    };
    const challenge = await getPendingWebAuthnChallenge(challengeContext);
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

    if (!await consumePendingWebAuthnChallenge(challengeContext, challenge)) {
      return NextResponse.json({ error: "WebAuthn challenge was already consumed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(10);
    const now = new Date();

    // Enable 2FA and store the passkey
    await db.transaction(async (tx: any) => {
      // Enable 2FA on user
      const [enabled] = await tx
        .update(users)
        .set({
          twoFactorEnabled: true,
          twoFactorEnforcedAt: now,
          mfaVerifiedAt: now, // Mark as verified since user just registered passkey
        })
        .where(and(eq(users.id, userId), eq(users.twoFactorEnabled, false)))
        .returning({ id: users.id });
      if (!enabled) throw new PasskeyEnrollmentConflictError();

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
  } catch (error) {
    console.error("Error confirming passkey registration");
    if (error instanceof PasskeyEnrollmentConflictError) {
      return NextResponse.json({ error: "2FA enrollment changed; restart setup" }, { status: 409 });
    }
    const publicError = safeApiError(error, "Failed to enable 2FA with passkey");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
