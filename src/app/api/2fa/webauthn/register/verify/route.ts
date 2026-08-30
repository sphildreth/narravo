// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { verifyWebAuthnRegistration } from "@/lib/2fa/webauthn";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { consumePendingWebAuthnChallenge, extractClientDataChallenge, getPendingWebAuthnChallenge } from "@/lib/2fa/webauthn-challenge";
import { getMfaSessionContext } from "@/lib/2fa/session-grant";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { safeApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
    }
    const { userId } = context;

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

    // Verify registration
    const verification = await verifyWebAuthnRegistration(body, challenge.challenge);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    if (!await consumePendingWebAuthnChallenge(challengeContext, challenge)) {
      return NextResponse.json({ error: "WebAuthn challenge was already consumed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    // Store credential
    await db.insert(ownerWebAuthnCredential).values({
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: body.response.transports ?? [],
      nickname: (body as any).nickname ?? null,
    });

    // Log activity
    await logSecurityActivity(userId, "passkey_added", { 
      nickname: (body as any).nickname 
    });

    return NextResponse.json({
      success: true,
      message: "WebAuthn credential registered successfully",
    });
  } catch (error) {
    console.error("Error verifying WebAuthn registration");
    const publicError = safeApiError(error, "Failed to verify registration");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
