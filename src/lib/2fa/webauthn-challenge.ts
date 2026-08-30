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
  // Keep exactly one ceremony of each kind per login session. An atomic
  // upsert bounds storage and makes a second options request invalidate the
  // first challenge even when requests arrive concurrently.
  const now = new Date();
  await db.insert(webauthnChallenge).values({
      userId,
      sessionId,
      ceremony,
      challenge,
      expiresAt: new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS),
    }).onConflictDoUpdate({
      target: [webauthnChallenge.userId, webauthnChallenge.sessionId, webauthnChallenge.ceremony],
      set: {
        challenge,
        expiresAt: new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS),
        consumedAt: null,
        createdAt: now,
      },
    });
}

/**
 * Look up the response's challenge only as a selector for a server record,
 * then atomically consume that record. Verification receives the returned DB
 * value, never the response value.
 */
export type PendingWebAuthnChallenge = { id: string; challenge: string };

/**
 * Load a pending server challenge for cryptographic verification. Reading it
 * does not consume it: malformed assertions cannot burn a legitimate
 * ceremony. The conditional consume below is the replay/race boundary.
 */
export async function getPendingWebAuthnChallenge(args: {
  userId: string;
  sessionId: string;
  ceremony: WebAuthnCeremony;
  responseChallenge: string;
}): Promise<PendingWebAuthnChallenge | null> {
  const [record] = await db
    .select({ id: webauthnChallenge.id, challenge: webauthnChallenge.challenge })
    .from(webauthnChallenge)
    .where(and(
      eq(webauthnChallenge.userId, args.userId),
      eq(webauthnChallenge.sessionId, args.sessionId),
      eq(webauthnChallenge.ceremony, args.ceremony),
      eq(webauthnChallenge.challenge, args.responseChallenge),
      isNull(webauthnChallenge.consumedAt),
      gt(webauthnChallenge.expiresAt, new Date()),
    ))
    .limit(1);

  return record ?? null;
}

/** Atomically consume the exact challenge only after verification succeeds. */
export async function consumePendingWebAuthnChallenge(
  args: {
    userId: string;
    sessionId: string;
    ceremony: WebAuthnCeremony;
  },
  pending: PendingWebAuthnChallenge,
): Promise<boolean> {
  const [record] = await db
    .update(webauthnChallenge)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(webauthnChallenge.id, pending.id),
      eq(webauthnChallenge.userId, args.userId),
      eq(webauthnChallenge.sessionId, args.sessionId),
      eq(webauthnChallenge.ceremony, args.ceremony),
      eq(webauthnChallenge.challenge, pending.challenge),
      isNull(webauthnChallenge.consumedAt),
      gt(webauthnChallenge.expiresAt, new Date()),
    ))
    .returning({ id: webauthnChallenge.id });
  return Boolean(record);
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
