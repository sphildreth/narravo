// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyTotpCode } from "@/lib/2fa/totp";
import { isRateLimited, resetRateLimit } from "@/lib/2fa/rate-limit";
import { createTrustedDevice, TRUSTED_DEVICE_COOKIE_NAME } from "@/lib/2fa/trusted-device";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
  rememberDevice: z.boolean().optional(),
});

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

    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { code, rememberDevice } = parsed.data;

    // Rate limiting
    const rateLimitKey = `2fa:totp:${userId}`;
    if (isRateLimited(rateLimitKey, 5, 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Get TOTP secret
    const [totp] = await db
      .select()
      .from(ownerTotp)
      .where(eq(ownerTotp.userId, userId))
      .limit(1);

    if (!totp || !totp.activatedAt) {
      return NextResponse.json(
        { error: "TOTP not enabled" },
        { status: 400 }
      );
    }

    // Verify the code
    const step = verifyTotpCode(totp.secretBase32, code);
    if (!step) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 400 }
      );
    }

    // Check for replay attack
    if (totp.lastUsedStep && step <= totp.lastUsedStep) {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 }
      );
    }

    // Update last used step
    await db
      .update(ownerTotp)
      .set({
        lastUsedAt: new Date(),
        lastUsedStep: step,
      })
      .where(eq(ownerTotp.userId, userId));

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

    // The session will be upgraded to mfa=true in the next request
    // via JWT callback. For now, we return success.
    const response = NextResponse.json({
      success: true,
      message: "2FA verification successful",
    });

    // Set trusted device cookie if requested
    if (trustedDeviceToken) {
      response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    return response;
  } catch (error: any) {
    console.error("Error verifying TOTP:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify TOTP" },
      { status: 500 }
    );
  }
}
