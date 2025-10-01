// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateTotpSecret, generateTotpUri, generateQrCodeDataUrl } from "@/lib/2fa/totp";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const userId = (session.user as any).id;

    // Check if TOTP is already enabled
    const [existing] = await db
      .select()
      .from(ownerTotp)
      .where(eq(ownerTotp.userId, userId))
      .limit(1);

    if (existing && existing.activatedAt) {
      return NextResponse.json(
        { error: "TOTP is already enabled" },
        { status: 400 }
      );
    }

    // Generate new secret
    const secret = generateTotpSecret();
    const email = session.user?.email ?? "user@example.com";
    const uri = generateTotpUri(secret, email);
    const qrCode = await generateQrCodeDataUrl(uri);

    // Store secret (upsert in case of partial enrollment)
    await db
      .insert(ownerTotp)
      .values({
        userId,
        secretBase32: secret,
      })
      .onConflictDoUpdate({
        target: ownerTotp.userId,
        set: {
          secretBase32: secret,
          activatedAt: null, // Reset activation status
        },
      });

    return NextResponse.json({
      secret,
      uri,
      qrCode,
    });
  } catch (error: any) {
    console.error("Error initializing TOTP:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize TOTP" },
      { status: 500 }
    );
  }
}
