// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from "vitest";

// Mock db to avoid real connections
vi.mock('@/lib/db', () => ({ 
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([]),
        limit: vi.fn().mockReturnValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue(undefined),
    transaction: vi.fn().mockImplementation(async (fn) => fn({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    })),
  }
}));

const { __testHelpers__ } = await import("@/lib/analytics");
const { isBot, hashIp, parseReferer, parseLang } = __testHelpers__;

describe("Analytics helpers", () => {
  it("should detect bots correctly", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 Selenium")).toBe(true);
    expect(isBot("Puppeteer")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/91.0")).toBe(false);
    expect(isBot(undefined, "https://example.com")).toBe(false);
    expect(isBot(undefined)).toBe(true);
  });

  it("should hash IP addresses", () => {
    process.env.ANALYTICS_IP_SALT = "test-salt";
    const hash1 = hashIp("192.168.1.1");
    const hash2 = hashIp("192.168.1.1");
    const hash3 = hashIp("192.168.1.2");
    
    expect(hash1).toBeTruthy();
    expect(hash1).toBe(hash2); // Same IP should produce same hash
    expect(hash1).not.toBe(hash3); // Different IPs should produce different hashes
    
    delete process.env.ANALYTICS_IP_SALT;
    expect(hashIp("192.168.1.1")).toBeNull();
  });

  it("should parse referer correctly", () => {
    expect(parseReferer("https://example.com/path?query=1")).toEqual({
      host: "example.com",
      path: "/path",
    });
    expect(parseReferer("invalid-url")).toEqual({});
    expect(parseReferer()).toEqual({});
  });

  it("should parse language correctly", () => {
    expect(parseLang("en-US,en;q=0.9")).toBe("en-US");
    expect(parseLang("fr")).toBe("fr");
    expect(parseLang("")).toBeUndefined();
    expect(parseLang()).toBeUndefined();
  });
});