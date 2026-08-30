// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from "vitest";

const buckets = vi.hoisted(() => new Map<string, { count: number; expiresAt: number }>());
vi.mock("@/lib/shared-rate-limit", () => ({
  consumeSharedRateLimit: vi.fn(async (key: string, max: number, windowMs: number) => {
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + windowMs }
      : { ...current, count: Math.min(current.count + 1, max + 1) };
    buckets.set(key, bucket);
    return {
      limited: bucket.count > max,
      remaining: Math.max(0, max - bucket.count),
      retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      resetTime: bucket.expiresAt,
    };
  }),
  peekSharedRateLimit: vi.fn(async (key: string, max: number) => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.expiresAt <= Date.now()) {
      return { limited: false, remaining: max, retryAfter: 0, resetTime: Date.now() };
    }
    return {
      limited: bucket.count >= max,
      remaining: Math.max(0, max - bucket.count),
      retryAfter: 1,
      resetTime: bucket.expiresAt,
    };
  }),
  resetSharedRateLimit: vi.fn(async (key: string) => { buckets.delete(key); }),
}));

import { getRemainingAttempts, isRateLimited, resetRateLimit } from "@/lib/2fa/rate-limit";

describe("database-backed 2FA rate limiting adapter", () => {
  beforeEach(() => buckets.clear());

  it("allows the configured number of attempts and rejects the next", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(isRateLimited("user-a", 5, 60_000)).resolves.toBe(false);
    }
    await expect(isRateLimited("user-a", 5, 60_000)).resolves.toBe(true);
    await expect(getRemainingAttempts("user-a", 5)).resolves.toBe(0);
  });

  it("keeps stable user keys independent", async () => {
    await isRateLimited("user-a", 1, 60_000);
    await expect(isRateLimited("user-a", 1, 60_000)).resolves.toBe(true);
    await expect(isRateLimited("user-b", 1, 60_000)).resolves.toBe(false);
  });

  it("resets explicitly", async () => {
    await isRateLimited("user-a", 1, 60_000);
    await resetRateLimit("user-a");
    await expect(getRemainingAttempts("user-a", 1)).resolves.toBe(1);
  });

  it("starts a new bucket after expiry", async () => {
    await isRateLimited("user-a", 1, 10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(isRateLimited("user-a", 1, 10)).resolves.toBe(false);
  });
});
