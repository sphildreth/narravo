// SPDX-License-Identifier: Apache-2.0
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { webauthnChallenge } from "@/drizzle/schema";

export type WebAuthnCeremony = "registration" | "authentication";
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function persistWebAuthnChallenge(
  userId: string,
  sessionId: string,
  ceremony: WebAuthnCeremony,
  challenge: string,
): Promise<void> {
  await db.insert(webauthnChallenge).values({
    userId,
    sessionId,
    ceremony,
    challenge,
    expiresAt: new Date(Date.now() + WEBAUTHN_CHALLENGE_TTL_MS),
  });
}

/**
 * Look up the response's challenge only as a selector for a server record,
 * then atomically consume that record. Verification receives the returned DB
 * value, never the response value.
 */
export async function consumeWebAuthnChallenge(args: {
  userId: string;
  sessionId: string;
  ceremony: WebAuthnCeremony;
  responseChallenge: string;
}): Promise<{ challenge: string } | null> {
  const [record] = await db
    .update(webauthnChallenge)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(webauthnChallenge.userId, args.userId),
      eq(webauthnChallenge.sessionId, args.sessionId),
      eq(webauthnChallenge.ceremony, args.ceremony),
      eq(webauthnChallenge.challenge, args.responseChallenge),
      isNull(webauthnChallenge.consumedAt),
      gt(webauthnChallenge.expiresAt, new Date()),
    ))
    .returning({ challenge: webauthnChallenge.challenge });

  return record ?? null;
}

export function extractClientDataChallenge(clientDataJSON: string): string | null {
  try {
    const raw = Buffer.from(clientDataJSON, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { challenge?: unknown };
    return typeof parsed.challenge === "string" && parsed.challenge.length > 0
      ? parsed.challenge
      : null;
  } catch {
    return null;
  }
}
