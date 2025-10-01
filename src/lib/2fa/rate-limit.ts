// SPDX-License-Identifier: Apache-2.0

/**
 * Simple in-memory rate limiter for 2FA attempts
 * In production, consider using Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier (e.g., IP address or user ID)
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limit exceeded, false otherwise
 */
export function isRateLimited(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 1000
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.resetAt < now) {
    // Window expired, reset
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= maxAttempts) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Get remaining attempts for a key
 */
export function getRemainingAttempts(key: string, maxAttempts: number = 5): number {
  const entry = rateLimitStore.get(key);
  if (!entry) return maxAttempts;
  
  const now = Date.now();
  if (entry.resetAt < now) return maxAttempts;
  
  return Math.max(0, maxAttempts - entry.count);
}
