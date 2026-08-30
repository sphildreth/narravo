// SPDX-License-Identifier: Apache-2.0
import {
  consumeSharedRateLimit,
  peekSharedRateLimit,
  resetSharedRateLimit,
} from "@/lib/shared-rate-limit";

export async function isRateLimited(
  key: string,
  maxAttempts = 5,
  windowMs = 60 * 1000,
): Promise<boolean> {
  return (await consumeSharedRateLimit(key, maxAttempts, windowMs)).limited;
}

export async function resetRateLimit(key: string): Promise<void> {
  await resetSharedRateLimit(key);
}

export async function getRemainingAttempts(key: string, maxAttempts = 5): Promise<number> {
  return (await peekSharedRateLimit(key, maxAttempts)).remaining;
}
