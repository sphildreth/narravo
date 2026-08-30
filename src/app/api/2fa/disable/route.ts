// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  mfaSessionGrant,
  ownerRecoveryCode,
  ownerTotp,
  ownerWebAuthnCredential,
  users,
  webauthnChallenge,
} from "@/drizzle/schema";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRateLimited, resetRateLimit } from "@/lib/2fa/rate-limit";
import { getMfaSessionContext } from "@/lib/2fa/session-grant";
import { logSecurityActivity } from "@/lib/2fa/security-activity";
import { decryptTotpSecret, protectTotpSecret } from "@/lib/2fa/totp-secret";
import { verifyRecoveryCode, verifyTotpCode } from "@/lib/2fa/totp";
import { revokeAllTrustedDevices } from "@/lib/2fa/trusted-device";
import { verifyWebAuthnAuthentication } from "@/lib/2fa/webauthn";
import {
  consumePendingWebAuthnChallenge,
  extractClientDataChallenge,
  getPendingWebAuthnChallenge,
} from "@/lib/2fa/webauthn-challenge";
import { safeApiError } from "@/lib/api-error";

const disableSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("totp"), code: z.string().regex(/^\d{6}$/) }),
  z.object({ method: z.literal("recovery"), code: z.string().min(8).max(10) }),
  z.object({ method: z.literal("webauthn"), response: z.unknown() }),
]);

type DisableRequest = z.infer<typeof disableSchema>;

async function verifyTotpStepUp(userId: string, code: string): Promise<boolean> {
  const [totp] = await db
    .select()
    .from(ownerTotp)
    .where(and(eq(ownerTotp.userId, userId), isNotNull(ownerTotp.activatedAt)))
    .limit(1);
  if (!totp) return false;

  const step = verifyTotpCode(decryptTotpSecret(totp.secretBase32), code);
  if (step === null || (totp.lastUsedStep !== null && step <= totp.lastUsedStep)) return false;

  const [updated] = await db
    .update(ownerTotp)
    .set({
      lastUsedAt: new Date(),
      lastUsedStep: step,
      secretBase32: protectTotpSecret(totp.secretBase32),
    })
    .where(and(
      eq(ownerTotp.userId, userId),
      totp.lastUsedStep === null
        ? isNull(ownerTotp.lastUsedStep)
        : eq(ownerTotp.lastUsedStep, totp.lastUsedStep),
    ))
    .returning({ userId: ownerTotp.userId });
  return Boolean(updated);
}

async function verifyRecoveryStepUp(userId: string, code: string): Promise<boolean> {
  const candidates = await db
    .select()
    .from(ownerRecoveryCode)
    .where(and(eq(ownerRecoveryCode.userId, userId), isNull(ownerRecoveryCode.usedAt)));
  const match = candidates.find((candidate: any) => verifyRecoveryCode(code, candidate.codeHash));
  if (!match) return false;

  const [used] = await db
    .update(ownerRecoveryCode)
    .set({ usedAt: new Date() })
    .where(and(eq(ownerRecoveryCode.id, match.id), isNull(ownerRecoveryCode.usedAt)))
    .returning({ id: ownerRecoveryCode.id });
  return Boolean(used);
}

async function verifyWebAuthnStepUp(
  userId: string,
  sessionId: string,
  responseValue: unknown,
): Promise<boolean> {
  const response = responseValue as AuthenticationResponseJSON;
  const responseChallenge = extractClientDataChallenge(response?.response?.clientDataJSON);
  if (!responseChallenge || typeof response?.id !== "string") return false;

  const challengeContext = {
    userId,
    sessionId,
    ceremony: "authentication" as const,
    responseChallenge,
  };
  const challenge = await getPendingWebAuthnChallenge(challengeContext);
  if (!challenge) return false;

  const [credential] = await db
    .select()
    .from(ownerWebAuthnCredential)
    .where(and(
      eq(ownerWebAuthnCredential.userId, userId),
      eq(ownerWebAuthnCredential.credentialId, response.id),
    ))
    .limit(1);
  if (!credential) return false;

  const verification = await verifyWebAuthnAuthentication(
    response,
    challenge.challenge,
    credential.publicKey,
    credential.counter,
  );
  if (!verification.verified) return false;
  if (!await consumePendingWebAuthnChallenge(challengeContext, challenge)) return false;

  const [counterUpdated] = await db
    .update(ownerWebAuthnCredential)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(and(
      eq(ownerWebAuthnCredential.id, credential.id),
      eq(ownerWebAuthnCredential.counter, credential.counter),
    ))
    .returning({ id: ownerWebAuthnCredential.id });
  return Boolean(counterUpdated);
}

async function verifyStepUp(
  userId: string,
  sessionId: string,
  request: DisableRequest,
): Promise<boolean> {
  if (request.method === "totp") return verifyTotpStepUp(userId, request.code);
  if (request.method === "recovery") return verifyRecoveryStepUp(userId, request.code);
  return verifyWebAuthnStepUp(userId, sessionId, request.response);
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const context = getMfaSessionContext(session);
    if (!context) {
      return NextResponse.json({ error: "Session refresh required" }, { status: 401 });
    }

    const parsed = disableSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A current second-factor verification is required" }, { status: 400 });
    }

    const rateLimitKey = `2fa:disable:${context.userId}`;
    if (await isRateLimited(rateLimitKey, 5, 5 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    let verified = false;
    try {
      verified = await verifyStepUp(context.userId, context.sessionId, parsed.data);
    } catch {
      verified = false;
    }
    if (!verified) {
      await logSecurityActivity(context.userId, "2fa_disable_failed", { method: parsed.data.method });
      return NextResponse.json({ error: "Second-factor verification failed" }, { status: 400 });
    }

    await db.transaction(async (tx: any) => {
      await tx
        .update(users)
        .set({ twoFactorEnabled: false, twoFactorEnforcedAt: null, mfaVerifiedAt: null })
        .where(eq(users.id, context.userId));
      await tx.delete(ownerTotp).where(eq(ownerTotp.userId, context.userId));
      await tx.delete(ownerWebAuthnCredential).where(eq(ownerWebAuthnCredential.userId, context.userId));
      await tx.delete(ownerRecoveryCode).where(eq(ownerRecoveryCode.userId, context.userId));
      await tx.delete(webauthnChallenge).where(eq(webauthnChallenge.userId, context.userId));
      await tx.delete(mfaSessionGrant).where(eq(mfaSessionGrant.userId, context.userId));
    });

    await revokeAllTrustedDevices(context.userId);
    await resetRateLimit(rateLimitKey);
    await logSecurityActivity(context.userId, "2fa_disabled", { method: parsed.data.method });

    return NextResponse.json({ success: true, message: "2FA has been disabled" });
  } catch (error) {
    console.error("Error disabling 2FA", error);
    const publicError = safeApiError(error, "Failed to disable 2FA");
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
