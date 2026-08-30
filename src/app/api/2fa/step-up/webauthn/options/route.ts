// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMfaSessionContext } from "@/lib/2fa/session-grant";
import { generateWebAuthnAuthenticationOptions } from "@/lib/2fa/webauthn";
import { persistWebAuthnChallenge } from "@/lib/2fa/webauthn-challenge";
import { safeApiError } from "@/lib/api-error";

export async function POST() {
  try {
    const session = await requireAdmin2FA();
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "Session refresh required" }, { status: 401 });
    }

    const credentials = await db
      .select({
        credentialId: ownerWebAuthnCredential.credentialId,
        transports: ownerWebAuthnCredential.transports,
      })
      .from(ownerWebAuthnCredential)
      .where(eq(ownerWebAuthnCredential.userId, context.userId));

    if (credentials.length === 0) {
      return NextResponse.json({ error: "No passkey is registered" }, { status: 400 });
    }

    const options = await generateWebAuthnAuthenticationOptions(
      credentials.map((credential: any) => ({
        credentialId: credential.credentialId,
        transports: (credential.transports as string[] | null) ?? [],
      })),
    );
    await persistWebAuthnChallenge(
      context.userId,
      context.sessionId,
      "authentication",
      options.challenge,
    );

    return NextResponse.json(options);
  } catch (error) {
    console.error("Error generating step-up WebAuthn options", error);
    const publicError = safeApiError(error, "Failed to start passkey verification");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
