// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdmin2FA, requireRecentLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateWebAuthnRegistrationOptions } from "@/lib/2fa/webauthn";
import { getMfaSessionContext } from "@/lib/2fa/session-grant";
import { persistWebAuthnChallenge } from "@/lib/2fa/webauthn-challenge";
import { safeApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    // Initial enrollment is allowed before MFA exists. Adding another
    // credential to an already protected account requires the current session
    // to have completed MFA before an options challenge is issued.
    let session = await requireAdmin();
    const userId = session.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [account] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (account.twoFactorEnabled) {
      session = await requireAdmin2FA();
    } else requireRecentLogin(session);
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
    }
    const { userId: contextUserId } = context;
    const email = session.user?.email ?? "user@example.com";
    const name = session.user?.name ?? "User";

    // Get existing credentials
    const existingCreds = await db
      .select({
        credentialId: ownerWebAuthnCredential.credentialId,
        transports: ownerWebAuthnCredential.transports,
      })
      .from(ownerWebAuthnCredential)
      .where(eq(ownerWebAuthnCredential.userId, contextUserId));

    const options = await generateWebAuthnRegistrationOptions(
      contextUserId,
      email,
      name,
      existingCreds.map((c: any) => ({
        credentialId: c.credentialId,
        transports: c.transports ?? [],
      }))
    );

    await persistWebAuthnChallenge(contextUserId, context.sessionId, "registration", options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error("Error generating WebAuthn registration options");
    const publicError = safeApiError(error, "Failed to generate registration options");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
