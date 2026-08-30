// SPDX-License-Identifier: Apache-2.0
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { mfaSessionGrant } from "@/drizzle/schema";

export const MFA_GRANT_TTL_MS = 5 * 60 * 1000;

export type MfaSessionContext = {
  userId: string;
  sessionId: string;
};

/** Return the server-issued opaque identifier carried by this signed session. */
export function getMfaSessionContext(session: unknown): MfaSessionContext | null {
  const value = session as { user?: { id?: unknown; mfaSessionId?: unknown } } | null;
  const userId = value?.user?.id;
  const sessionId = value?.user?.mfaSessionId;
  if (typeof userId !== "string" || !userId || typeof sessionId !== "string" || !sessionId) {
    return null;
  }
  return { userId, sessionId };
}

/** Create a grant after a factor has been verified. It is never client supplied. */
export async function createMfaSessionGrant({ userId, sessionId }: MfaSessionContext): Promise<void> {
  await db.insert(mfaSessionGrant).values({
    userId,
    sessionId,
    expiresAt: new Date(Date.now() + MFA_GRANT_TTL_MS),
  });
}

/**
 * Consume one grant atomically. A second callback invocation, another session,
 * or a request after expiry cannot consume the same row.
 */
export async function consumeMfaSessionGrant({ userId, sessionId }: MfaSessionContext): Promise<boolean> {
  const [grant] = await db
    .update(mfaSessionGrant)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(mfaSessionGrant.userId, userId),
      eq(mfaSessionGrant.sessionId, sessionId),
      isNull(mfaSessionGrant.consumedAt),
      gt(mfaSessionGrant.expiresAt, new Date()),
    ))
    .returning({ id: mfaSessionGrant.id });

  return Boolean(grant);
}
