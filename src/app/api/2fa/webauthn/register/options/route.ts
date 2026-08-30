// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateWebAuthnRegistrationOptions } from "@/lib/2fa/webauthn";
import { getMfaSessionContext } from "@/lib/2fa/session-grant";
import { persistWebAuthnChallenge } from "@/lib/2fa/webauthn-challenge";

export async function POST(req: NextRequest) {
  try {
    // Initial enrollment is allowed before MFA exists. Adding another
    // credential to an already protected account requires the current session
    // to have completed MFA before an options challenge is issued.
    let session = await requireAdmin();
    if ((session.user as any).twoFactorEnabled) {
      session = await requireAdmin2FA();
    }
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
    }
    const { userId } = context;
    const email = session.user?.email ?? "user@example.com";
    const name = session.user?.name ?? "User";

    // Get existing credentials
    const existingCreds = await db
      .select({
        credentialId: ownerWebAuthnCredential.credentialId,
        transports: ownerWebAuthnCredential.transports,
      })
      .from(ownerWebAuthnCredential)
      .where(eq(ownerWebAuthnCredential.userId, userId));

    const options = await generateWebAuthnRegistrationOptions(
      userId,
      email,
      name,
      existingCreds.map((c: any) => ({
        credentialId: c.credentialId,
        transports: c.transports ?? [],
      }))
    );

    await persistWebAuthnChallenge(userId, context.sessionId, "registration", options.challenge);

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Error generating WebAuthn registration options");
    return NextResponse.json(
      { error: error.message || "Failed to generate registration options" },
      { status: 500 }
    );
  }
}
