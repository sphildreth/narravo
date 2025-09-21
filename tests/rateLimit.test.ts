import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { 
  checkRateLimit, 
  recordAndCheckRateLimit,
  validateHoneypot,
  validateMinSubmitTime,
  validateAntiAbuse,
  RateLimitError,
  __testables__
} from "../lib/rateLimit";

const { InMemoryRateLimiter, extractIpFromHeaders, isValidIp } = __testables__;

// Mock the db module
vi.mock("../lib/db", () => ({
  db: {}
}));

// Mock the config service
const mockGetNumber = vi.fn();
vi.mock("../lib/config", () => ({
  ConfigServiceImpl: vi.fn().mockImplementation(() => ({
    getNumber: mockGetNumber
  }))
}));

describe("InMemoryRateLimiter", () => {
  let limiter: InstanceType<typeof InMemoryRateLimiter>;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it("should allow requests within limit", () => {
    const limit = 3;
    const windowMs = 60000; // 1 minute
    const key = "test-key";

    const check1 = limiter.recordRequest(key, limit, windowMs);
    expect(check1.allowed).toBe(true);
    expect(check1.remaining).toBe(2);

    const check2 = limiter.recordRequest(key, limit, windowMs);
    expect(check2.allowed).toBe(true);
    expect(check2.remaining).toBe(1);

    const check3 = limiter.recordRequest(key, limit, windowMs);
    expect(check3.allowed).toBe(true);
    expect(check3.remaining).toBe(0);
  });

  it("should reject requests exceeding limit", () => {
    const limit = 2;
    const windowMs = 60000;
    const key = "test-key";

    // Use up the limit
    limiter.recordRequest(key, limit, windowMs);
    limiter.recordRequest(key, limit, windowMs);

    // This should be rejected
    const check = limiter.recordRequest(key, limit, windowMs);
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.retryAfter).toBeGreaterThan(0);
  });

  it("should reset limits after window expires", async () => {
    const limit = 1;
    const windowMs = 100; // 100ms window for testing
    const key = "test-key";

    // Use up the limit
    const check1 = limiter.recordRequest(key, limit, windowMs);
    expect(check1.allowed).toBe(true);

    // Should be rejected immediately
    const check2 = limiter.recordRequest(key, limit, windowMs);
    expect(check2.allowed).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be allowed again
    const check3 = limiter.recordRequest(key, limit, windowMs);
    expect(check3.allowed).toBe(true);
  });

  it("should handle different keys independently", () => {
    const limit = 1;
    const windowMs = 60000;

    const check1 = limiter.recordRequest("key1", limit, windowMs);
    expect(check1.allowed).toBe(true);

    const check2 = limiter.recordRequest("key2", limit, windowMs);
    expect(check2.allowed).toBe(true);

    // Both keys should have used their limit
    const check3 = limiter.recordRequest("key1", limit, windowMs);
    expect(check3.allowed).toBe(false);

    const check4 = limiter.recordRequest("key2", limit, windowMs);
    expect(check4.allowed).toBe(false);
  });
});

describe("Rate limiting functions", () => {
  beforeEach(() => {
    mockGetNumber.mockImplementation((key: string) => {
      const defaults: Record<string, number> = {
        'RATE.COMMENTS-PER-MINUTE': 5,
        'RATE.REACTIONS-PER-MINUTE': 20,
        'RATE.MIN-SUBMIT-SECS': 2
      };
      return Promise.resolve(defaults[key] || null);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should check rate limits without recording", async () => {
    const options = {
      userId: "user1",
      ip: "192.168.1.1",
      action: "comment" as const
    };

    const check = await checkRateLimit(options);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBe(5); // COMMENTS limit
    expect(check.remaining).toBe(5);
  });

  it("should record and check rate limits", async () => {
    const options = {
      userId: "user1",
      ip: "192.168.1.1", 
      action: "reaction" as const
    };

    const check = await recordAndCheckRateLimit(options);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBe(20); // REACTIONS limit
    expect(check.remaining).toBe(19);
  });

  it("should enforce different limits for different actions", async () => {
    const baseOptions = {
      userId: "user1",
      ip: "192.168.1.1"
    };

    const commentCheck = await checkRateLimit({ ...baseOptions, action: "comment" });
    expect(commentCheck.limit).toBe(5);

    const reactionCheck = await checkRateLimit({ ...baseOptions, action: "reaction" });
    expect(reactionCheck.limit).toBe(20);
  });

  it("should create different keys for different users", async () => {
    const baseOptions = {
      ip: "192.168.1.1",
      action: "comment" as const
    };

    const user1Id = `user1-${Date.now()}-${Math.random()}`;
    const user2Id = `user2-${Date.now()}-${Math.random()}`;

    // User 1 uses up their limit
    for (let i = 0; i < 5; i++) {
      await recordAndCheckRateLimit({ ...baseOptions, userId: user1Id });
    }

    // User 1 should be limited
    const user1Check = await recordAndCheckRateLimit({ ...baseOptions, userId: user1Id });
    expect(user1Check.allowed).toBe(false);

    // User 2 should still be allowed
    const user2Check = await recordAndCheckRateLimit({ ...baseOptions, userId: user2Id });
    expect(user2Check.allowed).toBe(true);
  });

  it("should create different keys for different IPs", async () => {
    const baseUserId = `user-${Date.now()}-${Math.random()}`;
    const baseOptions = {
      userId: baseUserId,
      action: "comment" as const
    };

    // Same user from IP 1 uses up their limit
    for (let i = 0; i < 5; i++) {
      await recordAndCheckRateLimit({ ...baseOptions, ip: "192.168.1.1" });
    }

    // Same user from IP 1 should be limited
    const ip1Check = await recordAndCheckRateLimit({ ...baseOptions, ip: "192.168.1.1" });
    expect(ip1Check.allowed).toBe(false);

    // Same user from IP 2 should still be allowed
    const ip2Check = await recordAndCheckRateLimit({ ...baseOptions, ip: "192.168.1.2" });
    expect(ip2Check.allowed).toBe(true);
  });
});

describe("IP extraction", () => {
  it("should extract IP from x-forwarded-for header", () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1, 10.0.0.1'
    });
    
    const ip = extractIpFromHeaders(headers);
    expect(ip).toBe('192.168.1.1');
  });

  it("should extract IP from x-real-ip header", () => {
    const headers = new Headers({
      'x-real-ip': '192.168.1.2'
    });
    
    const ip = extractIpFromHeaders(headers);
    expect(ip).toBe('192.168.1.2');
  });

  it("should return null for invalid IPs", () => {
    const headers = new Headers({
      'x-forwarded-for': 'invalid-ip'
    });
    
    const ip = extractIpFromHeaders(headers);
    expect(ip).toBe(null);
  });

  it("should return null when no headers provided", () => {
    const ip = extractIpFromHeaders(undefined);
    expect(ip).toBe(null);
  });
});

describe("IP validation", () => {
  it("should validate IPv4 addresses", () => {
    expect(isValidIp('192.168.1.1')).toBe(true);
    expect(isValidIp('10.0.0.1')).toBe(true);
    expect(isValidIp('127.0.0.1')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
  });

  it("should reject invalid IPv4 addresses", () => {
    expect(isValidIp('256.1.1.1')).toBe(false);
    expect(isValidIp('192.168.1')).toBe(false);
    expect(isValidIp('not-an-ip')).toBe(false);
    expect(isValidIp('')).toBe(false);
  });

  it("should validate IPv6 addresses", () => {
    expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(isValidIp('::1')).toBe(false); // Simplified notation not supported by our basic regex
  });
});

describe("Honeypot validation", () => {
  it("should accept empty honeypot values", () => {
    expect(validateHoneypot("")).toBe(true);
    expect(validateHoneypot("   ")).toBe(true);
    expect(validateHoneypot(null)).toBe(true);
    expect(validateHoneypot(undefined)).toBe(true);
  });

  it("should reject non-empty honeypot values", () => {
    expect(validateHoneypot("bot-content")).toBe(false);
    expect(validateHoneypot("spam")).toBe(false);
    expect(validateHoneypot("  content  ")).toBe(false);
  });
});

describe("Submit time validation", () => {
  beforeEach(() => {
    mockGetNumber.mockImplementation((key: string) => {
      const defaults: Record<string, number> = {
        'RATE.COMMENTS-PER-MINUTE': 5,
        'RATE.REACTIONS-PER-MINUTE': 20,
        'RATE.MIN-SUBMIT-SECS': 2
      };
      return Promise.resolve(defaults[key] || null);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should accept submissions after minimum time", async () => {
    const startTime = Date.now() - 3000; // 3 seconds ago
    const result = await validateMinSubmitTime(startTime);
    
    expect(result.valid).toBe(true);
    expect(result.actualTime).toBeGreaterThanOrEqual(2);
    expect(result.requiredTime).toBe(2);
  });

  it("should reject submissions before minimum time", async () => {
    const startTime = Date.now() - 1000; // 1 second ago
    const result = await validateMinSubmitTime(startTime);
    
    expect(result.valid).toBe(false);
    expect(result.actualTime).toBeLessThan(2);
    expect(result.requiredTime).toBe(2);
  });

  it("should reject invalid start times", async () => {
    expect((await validateMinSubmitTime(null)).valid).toBe(false);
    expect((await validateMinSubmitTime(undefined)).valid).toBe(false);
    expect((await validateMinSubmitTime("invalid" as any)).valid).toBe(false);
  });
});

describe("Anti-abuse validation", () => {
  beforeEach(() => {
    mockGetNumber.mockImplementation((key: string) => {
      const defaults: Record<string, number> = {
        'RATE.COMMENTS-PER-MINUTE': 5,
        'RATE.REACTIONS-PER-MINUTE': 20,
        'RATE.MIN-SUBMIT-SECS': 2
      };
      return Promise.resolve(defaults[key] || null);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should pass valid submissions", async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "",
      submitStartTime: Date.now() - 3000,
      headers: new Headers({ 'x-real-ip': '192.168.1.1' })
    });

    // Debug output
    if (!result.valid) {
      console.log("Validation failed:", result.error);
    }

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.rateLimitInfo?.allowed).toBe(true);
  });

  it("should reject honeypot spam", async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "spam-content",
      submitStartTime: Date.now() - 3000
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid form submission");
  });

  it("should reject too-fast submissions", async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "",
      submitStartTime: Date.now() - 500 // 0.5 seconds ago
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Submission too fast");
  });

  it("should reject rate-limited submissions", async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const baseValidation = {
      honeypot: "",
      submitStartTime: Date.now() - 3000,
      headers: new Headers({ 'x-real-ip': '192.168.1.1' })
    };

    // Use up the rate limit (5 comments per minute)
    for (let i = 0; i < 5; i++) {
      await validateAntiAbuse(uniqueUserId, "comment", baseValidation);
    }

    // Next attempt should be rejected
    const result = await validateAntiAbuse(uniqueUserId, "comment", baseValidation);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Rate limit exceeded");
    expect(result.rateLimitInfo?.allowed).toBe(false);
  });

  it("should handle validation errors gracefully", async () => {
    // Make mockGetNumber reject
    mockGetNumber.mockRejectedValue(new Error("Config error"));
    
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "",
      submitStartTime: Date.now() - 3000
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Validation failed");
  });
});