// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { verifyWebAuthnRegistration } from "@/lib/2fa/webauthn";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const userId = (session.user as any).id;

    const body: RegistrationResponseJSON = await req.json();

    // Extract challenge from clientDataJSON
    const clientData = JSON.parse(
      Buffer.from(body.response.clientDataJSON, "base64").toString()
    );
    const expectedChallenge = clientData.challenge;

    // Verify registration
    const verification = await verifyWebAuthnRegistration(body, expectedChallenge);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
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
  } catch (error: any) {
    console.error("Error verifying WebAuthn registration:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify registration" },
      { status: 500 }
    );
  }
}
