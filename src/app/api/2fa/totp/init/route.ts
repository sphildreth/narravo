// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdmin2FA, requireRecentLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateTotpSecret, generateTotpUri, generateQrCodeDataUrl } from "@/lib/2fa/totp";
import { encryptTotpSecret } from "@/lib/2fa/totp-secret";
import { safeApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    let session = await requireAdmin();
    const userId = (session.user as any).id;

    const [account] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (account.twoFactorEnabled) session = await requireAdmin2FA();
    else requireRecentLogin(session);

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
    const protectedSecret = encryptTotpSecret(secret);
    const email = session.user?.email ?? "user@example.com";
    const uri = generateTotpUri(secret, email);
    const qrCode = await generateQrCodeDataUrl(uri);

    // Store secret (upsert in case of partial enrollment)
    await db
      .insert(ownerTotp)
      .values({
        userId,
        secretBase32: protectedSecret,
      })
      .onConflictDoUpdate({
        target: ownerTotp.userId,
        set: {
          secretBase32: protectedSecret,
          activatedAt: null, // Reset activation status
        },
      });

    return NextResponse.json({
      secret,
      uri,
      qrCode,
    });
  } catch (error) {
    console.error("Error initializing TOTP:", error);
    const publicError = safeApiError(error, "Failed to initialize TOTP");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
