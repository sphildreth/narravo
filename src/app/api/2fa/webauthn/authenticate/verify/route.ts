// SPDX-License-Identifier: Apache-2.0
import { NextResponse, NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyWebAuthnAuthentication } from "@/lib/2fa/webauthn";
import { isRateLimited, resetRateLimit } from "@/lib/2fa/rate-limit";
import { createTrustedDevice, TRUSTED_DEVICE_COOKIE_NAME } from "@/lib/2fa/trusted-device";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

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

    const body: AuthenticationResponseJSON & { rememberDevice?: boolean } = await req.json();
    const { rememberDevice, ...authResponse } = body;

    // Extract challenge from clientDataJSON
    const clientData = JSON.parse(
      Buffer.from(authResponse.response.clientDataJSON, "base64").toString()
    );
    const expectedChallenge = clientData.challenge;

    // Rate limiting
    const rateLimitKey = `2fa:webauthn:${userId}`;
    if (isRateLimited(rateLimitKey, 5, 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Get credential
    const [credential] = await db
      .select()
      .from(ownerWebAuthnCredential)
      .where(eq(ownerWebAuthnCredential.credentialId, authResponse.id))
      .limit(1);

    if (!credential) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 400 }
      );
    }

    // Verify authentication
    const verification = await verifyWebAuthnAuthentication(
      authResponse,
      expectedChallenge,
      credential.publicKey,
      credential.counter
    );

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    // Update counter
    await db
      .update(ownerWebAuthnCredential)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(ownerWebAuthnCredential.id, credential.id));

    // Mark 2FA as verified in user record
    await db
      .update(users)
      .set({
        mfaVerifiedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Reset rate limit on success
    resetRateLimit(rateLimitKey);

    // Handle "remember this device"
    let trustedDeviceToken: string | null = null;
    if (rememberDevice) {
      const userAgent = req.headers.get("user-agent");
      const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
      trustedDeviceToken = await createTrustedDevice(userId, userAgent, ip);
      await logSecurityActivity(userId, "trusted_device_added", {
        userAgent,
      });
    }

    const apiResponse = NextResponse.json({
      success: true,
      message: "WebAuthn verification successful",
    });

    // Set trusted device cookie if requested
    if (trustedDeviceToken) {
      apiResponse.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    return apiResponse;
  } catch (error: any) {
    console.error("Error verifying WebAuthn authentication:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify authentication" },
      { status: 500 }
    );
  }
}
