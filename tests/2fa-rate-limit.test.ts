// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  resetRateLimit,
  getRemainingAttempts,
} from "@/lib/2fa/rate-limit";

describe("2FA Rate Limiting", () => {
  const testKey = "test:key";

  beforeEach(() => {
    // Reset rate limit before each test
    resetRateLimit(testKey);
  });

  describe("isRateLimited", () => {
    it("should not rate limit the first attempt", () => {
      expect(isRateLimited(testKey, 5, 60000)).toBe(false);
    });

    it("should not rate limit within the max attempts", () => {
      for (let i = 0; i < 5; i++) {
        expect(isRateLimited(testKey, 5, 60000)).toBe(false);
      }
    });

    it("should rate limit after exceeding max attempts", () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        isRateLimited(testKey, 5, 60000);
      }
      
      // Next attempt should be rate limited
      expect(isRateLimited(testKey, 5, 60000)).toBe(true);
    });

    it("should reset after window expires", async () => {
      // Use up all attempts with a short window
      for (let i = 0; i < 3; i++) {
        isRateLimited(testKey, 3, 100); // 100ms window
      }
      
      expect(isRateLimited(testKey, 3, 100)).toBe(true);
      
      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Should be allowed again
      expect(isRateLimited(testKey, 3, 100)).toBe(false);
    });

    it("should handle different keys independently", () => {
      const key1 = "key1";
      const key2 = "key2";
      
      // Use up attempts for key1
      for (let i = 0; i < 5; i++) {
        isRateLimited(key1, 5, 60000);
      }
      
      expect(isRateLimited(key1, 5, 60000)).toBe(true);
      expect(isRateLimited(key2, 5, 60000)).toBe(false);
      
      resetRateLimit(key1);
      resetRateLimit(key2);
    });
  });

  describe("resetRateLimit", () => {
    it("should reset the rate limit for a key", () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        isRateLimited(testKey, 5, 60000);
      }
      
      expect(isRateLimited(testKey, 5, 60000)).toBe(true);
      
      // Reset
      resetRateLimit(testKey);
      
      // Should be allowed again
      expect(isRateLimited(testKey, 5, 60000)).toBe(false);
    });
  });

  describe("getRemainingAttempts", () => {
    it("should return max attempts for a new key", () => {
      expect(getRemainingAttempts(testKey, 5)).toBe(5);
    });

    it("should decrement with each attempt", () => {
      expect(getRemainingAttempts(testKey, 5)).toBe(5);
      
      isRateLimited(testKey, 5, 60000);
      expect(getRemainingAttempts(testKey, 5)).toBe(4);
      
      isRateLimited(testKey, 5, 60000);
      expect(getRemainingAttempts(testKey, 5)).toBe(3);
    });

    it("should return 0 when rate limited", () => {
      for (let i = 0; i < 5; i++) {
        isRateLimited(testKey, 5, 60000);
      }
      
      expect(getRemainingAttempts(testKey, 5)).toBe(0);
    });

    it("should reset after window expires", async () => {
      isRateLimited(testKey, 3, 100);
      expect(getRemainingAttempts(testKey, 3)).toBe(2);
      
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      expect(getRemainingAttempts(testKey, 3)).toBe(3);
    });
  });
});
