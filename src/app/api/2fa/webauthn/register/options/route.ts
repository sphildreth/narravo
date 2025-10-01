// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateWebAuthnRegistrationOptions } from "@/lib/2fa/webauthn";

export async function POST(req: NextRequest) {
  try {
    // Use requireAdmin instead of requireAdmin2FA to allow initial enrollment
    const session = await requireAdmin();
    const userId = (session.user as any).id;
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

    // Store challenge in session or temporary storage
    // For simplicity, we'll return it to client and expect it back
    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Error generating WebAuthn registration options:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate registration options" },
      { status: 500 }
    );
  }
}
