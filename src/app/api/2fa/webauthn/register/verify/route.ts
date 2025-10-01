// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { verifyWebAuthnRegistration } from "@/lib/2fa/webauthn";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { z } from "zod";

const verifySchema = z.object({
  response: z.any(),
  expectedChallenge: z.string(),
  nickname: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const userId = (session.user as any).id;

    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { response, expectedChallenge, nickname } = parsed.data;

    // Verify registration
    const verification = await verifyWebAuthnRegistration(response, expectedChallenge);

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
      credentialId: Buffer.from(credential.id).toString("base64"),
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      aaguid: null,
      nickname: nickname ?? null,
    });

    // Log activity
    await logSecurityActivity(userId, "passkey_added", { nickname });

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
