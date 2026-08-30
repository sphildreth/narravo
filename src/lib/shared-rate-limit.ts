// SPDX-License-Identifier: Apache-2.0
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type SharedRateLimitResult = {
  limited: boolean;
  remaining: number;
  retryAfter: number;
  resetTime: number;
};

function digestKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function firstRow(result: unknown): { count?: unknown; expires_at?: unknown } | undefined {
  const value = result as { rows?: unknown[]; 0?: unknown };
  return (value.rows?.[0] ?? value[0]) as { count?: unknown; expires_at?: unknown } | undefined;
}

/** Atomically record an attempt in a database-backed, process-shared bucket. */
export async function consumeSharedRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<SharedRateLimitResult> {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 ||
      !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error("Invalid rate-limit configuration");
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const result = await db.execute(sql`
    INSERT INTO rate_limit_bucket (key, count, window_started_at, expires_at)
    VALUES (${digestKey(key)}, 1, ${now}, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_bucket.expires_at <= ${now} THEN 1
        ELSE LEAST(rate_limit_bucket.count + 1, ${maxAttempts + 1})
      END,
      window_started_at = CASE
        WHEN rate_limit_bucket.expires_at <= ${now} THEN ${now}
        ELSE rate_limit_bucket.window_started_at
      END,
      expires_at = CASE
        WHEN rate_limit_bucket.expires_at <= ${now} THEN ${expiresAt}
        ELSE rate_limit_bucket.expires_at
      END
    RETURNING count, expires_at
  `);
  const row = firstRow(result);
  const count = Number(row?.count);
  const resetTime = new Date(String(row?.expires_at)).getTime();
  if (!Number.isFinite(count) || !Number.isFinite(resetTime)) {
    throw new Error("Rate-limit store returned an invalid result");
  }
  return {
    limited: count > maxAttempts,
    remaining: Math.max(0, maxAttempts - count),
    retryAfter: Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)),
    resetTime,
  };
}

/** Remove a bounded batch of expired attacker-controlled bucket identities. */
export async function pruneExpiredRateLimitBuckets(limit = 1000): Promise<void> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error("Invalid rate-limit cleanup size");
  }
  await db.execute(sql`
    DELETE FROM rate_limit_bucket
    WHERE key IN (
      SELECT key FROM rate_limit_bucket
      WHERE expires_at <= ${new Date()}
      LIMIT ${limit}
    )
  `);
}

export async function peekSharedRateLimit(
  key: string,
  maxAttempts: number,
): Promise<SharedRateLimitResult> {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Invalid rate-limit configuration");
  }
  const now = new Date();
  const result = await db.execute(sql`
    SELECT count, expires_at
    FROM rate_limit_bucket
    WHERE key = ${digestKey(key)} AND expires_at > ${now}
    LIMIT 1
  `);
  const row = firstRow(result);
  if (!row) {
    return { limited: false, remaining: maxAttempts, retryAfter: 0, resetTime: now.getTime() };
  }
  const count = Number(row.count);
  const resetTime = new Date(String(row.expires_at)).getTime();
  return {
    limited: count >= maxAttempts,
    remaining: Math.max(0, maxAttempts - count),
    retryAfter: Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)),
    resetTime,
  };
}

export async function resetSharedRateLimit(key: string): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limit_bucket WHERE key = ${digestKey(key)}`);
}
