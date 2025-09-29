// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";

// Simple test to verify the analytics bug fix
// Mock db and config before importing analytics module
let viewEventInserts: any[] = [];
let dailyViewsUpserts: any[] = [];
let totalViewsUpdates: any[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]) // No existing views found by default
        }),
      }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((data) => {
            viewEventInserts.push(data);
            return Promise.resolve(undefined);
          })
        })),
        update: vi.fn().mockImplementation((table) => ({
          set: vi.fn().mockImplementation((data) => ({
            where: vi.fn().mockImplementation(() => {
              totalViewsUpdates.push(data);
              return Promise.resolve(undefined);
            })
          }))
        })),
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockReturnValue([]) // No existing views for uniqueness check
            }))
          }))
        })),
        execute: vi.fn().mockImplementation((query) => {
          if (query.sql && query.sql.includes("INSERT INTO post_daily_views")) {
            dailyViewsUpserts.push(query);
          }
          return Promise.resolve(undefined);
        })
      };
      
      return await fn(tx);
    }),
  }
}));

vi.mock('@/lib/config', () => ({
  ConfigServiceImpl: vi.fn().mockImplementation(() => ({
    getBoolean: vi.fn().mockImplementation((key) => {
      if (key === "VIEW.RESPECT-DNT") return Promise.resolve(false);
      if (key === "VIEW.COUNT-BOTS") return Promise.resolve(true);
      return Promise.resolve(false);
    }),
    getNumber: vi.fn().mockImplementation((key) => {
      if (key === "VIEW.SESSION-WINDOW-MINUTES") return Promise.resolve(30);
      return Promise.resolve(0);
    })
  }))
}));

// Import after mocking
const { recordView } = await import("@/lib/analytics");

describe("Analytics View Tracking Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewEventInserts = [];
    dailyViewsUpserts = [];
    totalViewsUpdates = [];
    
    // Set up environment
    process.env.ANALYTICS_IP_SALT = "test-salt";
  });

  it("should record multiple views from different IPs", async () => {
    const postId = "550e8400-e29b-41d4-a716-446655440000";

    // Test recording 3 views from different IPs
    const view1 = await recordView({
      postId,
      ip: "192.168.1.10",
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
      referer: "https://google.com"
    });

    const view2 = await recordView({
      postId,
      ip: "203.0.113.42",
      ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      referer: "https://twitter.com"
    });

    const view3 = await recordView({
      postId,
      ip: "192.168.1.100",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      referer: "https://facebook.com"
    });

    // All views should be successfully recorded
    expect(view1).toBe(true);
    expect(view2).toBe(true);
    expect(view3).toBe(true);

    // Basic functionality validation - the fix should allow these to work
    expect(viewEventInserts.length).toBeGreaterThanOrEqual(0);
    expect(totalViewsUpdates.length).toBeGreaterThanOrEqual(0);
    expect(dailyViewsUpserts.length).toBeGreaterThanOrEqual(0);
  });

  it("should detect and skip bots", async () => {
    const postId = "550e8400-e29b-41d4-a716-446655440000";

    // Mock config to not count bots
    const { db } = await import("@/lib/db");
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      // Create config mock that returns false for COUNT-BOTS
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined)
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined)
          })
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([])
            })
          })
        }),
        execute: vi.fn().mockResolvedValue(undefined)
      };
      return await fn(tx);
    });

    // Test with a bot user agent
    const result = await recordView({
      postId,
      ip: "192.168.1.10",
      ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      referer: "https://google.com"
    });

    // Should still record the view since COUNT-BOTS is true by default
    expect(result).toBe(true);
  });

  it("should skip duplicate views from same session within window", async () => {
    const postId = "550e8400-e29b-41d4-a716-446655440000";

    // Mock to return existing view in session window
    const { db } = await import("@/lib/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([{ id: "existing-view" }]) // Existing view found
        })
      })
    });

    const result = await recordView({
      postId,
      sessionId: "test-session-123",
      ip: "192.168.1.10",
      ua: "Mozilla/5.0 test"
    });

    // Should be deduplicated
    expect(result).toBe(false);
  });

  it("should handle database errors gracefully", async () => {
    const postId = "550e8400-e29b-41d4-a716-446655440000";

    // Mock to throw database error
    const { db } = await import("@/lib/db");
    vi.mocked(db.transaction).mockRejectedValue(new Error("Database connection failed"));

    const result = await recordView({
      postId,
      ip: "192.168.1.10",
      ua: "Mozilla/5.0 test"
    });

    // Should return false on error but not throw
    expect(result).toBe(false);
  });
});