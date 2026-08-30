// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerRecoveryCode, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyRecoveryCode } from "@/lib/2fa/totp";
import { isRateLimited, resetRateLimit } from "@/lib/2fa/rate-limit";
import { createTrustedDevice, TRUSTED_DEVICE_COOKIE_NAME } from "@/lib/2fa/trusted-device";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { z } from "zod";
import { and, isNull } from "drizzle-orm";
import { createMfaSessionGrant, getMfaSessionContext } from "@/lib/2fa/session-grant";

const verifySchema = z.object({
  code: z.string().min(8).max(10),
  rememberDevice: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "MFA session is invalid or expired" }, { status: 401 });
    }
    const { userId } = context;
    
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
    const rateLimitKey = `2fa:recovery:${userId}`;
    if (isRateLimited(rateLimitKey, 3, 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Get unused recovery codes
    const recoveryCodes = await db
      .select()
      .from(ownerRecoveryCode)
      .where(
        eq(ownerRecoveryCode.userId, userId)
      );

    const unusedCodes = recoveryCodes.filter((rc: any) => !rc.usedAt);

    if (unusedCodes.length === 0) {
      return NextResponse.json(
        { error: "No recovery codes available" },
        { status: 400 }
      );
    }

    // Try to verify against all unused codes
    let matchedCode: typeof unusedCodes[0] | null = null;
    for (const recoveryCode of unusedCodes) {
      if (verifyRecoveryCode(code, recoveryCode.codeHash)) {
        matchedCode = recoveryCode;
        break;
      }
    }

    if (!matchedCode) {
      return NextResponse.json(
        { error: "Invalid recovery code" },
        { status: 400 }
      );
    }

    // Mark code as used
    const [used] = await db
      .update(ownerRecoveryCode)
      .set({ usedAt: new Date() })
      .where(and(eq(ownerRecoveryCode.id, matchedCode.id), isNull(ownerRecoveryCode.usedAt)))
      .returning({ id: ownerRecoveryCode.id });

    if (!used) {
      return NextResponse.json({ error: "Recovery code already used" }, { status: 400 });
    }

    // Mark 2FA as verified in user record
    await db
      .update(users)
      .set({
        mfaVerifiedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await createMfaSessionGrant(context);

    // Reset rate limit on success
    resetRateLimit(rateLimitKey);

    // Log activity
    await logSecurityActivity(userId, "recovery_code_used", {
      remainingCodes: unusedCodes.length - 1,
    });

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

    const response = NextResponse.json({
      success: true,
      message: "Recovery code verified successfully",
      remainingCodes: unusedCodes.length - 1,
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
    console.error("Error verifying recovery code");
    return NextResponse.json(
      { error: error.message || "Failed to verify recovery code" },
      { status: 500 }
    );
  }
}
