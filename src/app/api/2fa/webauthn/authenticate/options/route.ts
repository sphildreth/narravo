// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateWebAuthnAuthenticationOptions } from "@/lib/2fa/webauthn";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const userId = (session.user as any).id;

    // Check if user has mfaPending status
    if (!(session.user as any).mfaPending) {
      return NextResponse.json(
        { error: "2FA not required" },
        { status: 400 }
      );
    }

    // Get user's credentials
    const credentials = await db
      .select({
        credentialId: ownerWebAuthnCredential.credentialId,
        transports: ownerWebAuthnCredential.transports,
      })
      .from(ownerWebAuthnCredential)
      .where(eq(ownerWebAuthnCredential.userId, userId));

    if (credentials.length === 0) {
      return NextResponse.json(
        { error: "No WebAuthn credentials registered" },
        { status: 400 }
      );
    }

    const options = await generateWebAuthnAuthenticationOptions(
      credentials.map((c: any) => ({
        credentialId: c.credentialId,
        transports: c.transports ?? [],
      }))
    );

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Error generating WebAuthn authentication options:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate authentication options" },
      { status: 500 }
    );
  }
}
