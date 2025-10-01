// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordPageView, getTrendingPages, getPageViewCounts, getPageSparkline } from "@/lib/analytics";

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  },
}));

// Mock the configuration module
vi.mock("@/lib/config", () => ({
  ConfigServiceImpl: vi.fn().mockImplementation(() => ({
    getBoolean: vi.fn().mockImplementation((key: string) => {
      const config: Record<string, boolean> = {
        "VIEW.RESPECT-DNT": false,
        "VIEW.COUNT-BOTS": false, // Default to blocking bots
      };
      return Promise.resolve(config[key] ?? false);
    }),
    getNumber: vi.fn().mockImplementation((key: string) => {
      const config: Record<string, number> = {
        "VIEW.SESSION-WINDOW-MINUTES": 30,
        "VIEW.TRENDING-DAYS": 7,
      };
      return Promise.resolve(config[key] ?? 0);
    }),
  })),
}));

// Mock the logger module
vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Page View Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordPageView", () => {
    it("should record a page view successfully", async () => {
      const { db } = await import("@/lib/db");
      
      // Mock the deduplication check to return no existing views
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        }),
      });

      // Mock a successful transaction
      (db.transaction as any).mockImplementation(async (callback: any) => {
        const mockTx = {
          insert: vi.fn().mockImplementation(() => ({
            values: vi.fn().mockImplementation(() => ({
              // Both resolve to a Promise and have onConflictDoUpdate available
              onConflictDoUpdate: vi.fn().mockReturnValue(Promise.resolve()),
              then: (resolve: any) => resolve(), // Make it thenable like a Promise
              catch: () => {},
            })),
          })),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(Promise.resolve([])),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockReturnValue(Promise.resolve()),
              }),
            }),
          }),
        };
        
        // Execute the callback successfully
        await callback(mockTx);
        return undefined; // Transaction doesn't return anything
      });

      // Mock process.env.ANALYTICS_IP_SALT
      vi.stubEnv('ANALYTICS_IP_SALT', 'test-salt');

      // Use a non-bot user agent to ensure the test passes
      const result = await recordPageView({
        path: "/",
        sessionId: "test-session-123",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        referer: "https://google.com",
        lang: "en-US",
      });

      expect(result).toBe(true);
    });

    it("should skip recording for duplicate views within session window", async () => {
      const { db } = await import("@/lib/db");
      
      // Mock existing view in session window
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([{ id: "existing-view" }])),
          }),
        }),
      });

      const result = await recordPageView({
        path: "/about",
        sessionId: "test-session-123",
      });

      expect(result).toBe(false);
    });

    it("should skip recording for bots when configured", async () => {
      const result = await recordPageView({
        path: "/contact",
        ua: "Googlebot/2.1",
      });

      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      const { db } = await import("@/lib/db");
      
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        }),
      });

      (db.transaction as any).mockRejectedValue(new Error("Database error"));

      const result = await recordPageView({
        path: "/error-test",
        sessionId: "test-session",
      });

      expect(result).toBe(false);
    });
  });

  describe("getTrendingPages", () => {
    it("should return trending pages with view counts", async () => {
      const { db } = await import("@/lib/db");
      
      const mockPages = [
        { path: "/", viewsLastNDays: "150" },
        { path: "/about", viewsLastNDays: "75" },
        { path: "/contact", viewsLastNDays: "25" },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(Promise.resolve(mockPages)),
              }),
            }),
          }),
        }),
      });

      const result = await getTrendingPages({ days: 7, limit: 10 });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        path: "/",
        viewsLastNDays: 150,
        totalViews: 0,
      });
      expect(result[1]).toEqual({
        path: "/about",
        viewsLastNDays: 75,
        totalViews: 0,
      });
    });

    it("should handle missing daily views table gracefully", async () => {
      const { db } = await import("@/lib/db");
      
      const error = new Error("relation \"page_daily_views\" does not exist") as any;
      error.code = "42P01";
      
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockRejectedValue(error),
              }),
            }),
          }),
        }),
      });

      const result = await getTrendingPages({ days: 7, limit: 10 });

      expect(result).toEqual([]);
    });
  });

  describe("getPageViewCounts", () => {
    it("should return view counts for specified paths", async () => {
      const { db } = await import("@/lib/db");
      
      const mockResults = [
        { path: "/", recentViews: "100" },
        { path: "/about", recentViews: "50" },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue(Promise.resolve(mockResults)),
          }),
        }),
      });

      const result = await getPageViewCounts(["/", "/about", "/contact"]);

      expect(result.size).toBe(3);
      expect(result.get("/")).toEqual({
        path: "/",
        totalViews: 0,
        viewsLastNDays: 100,
      });
      expect(result.get("/contact")).toEqual({
        path: "/contact",
        totalViews: 0,
        viewsLastNDays: 0,
      });
    });

    it("should return empty map for empty input", async () => {
      const result = await getPageViewCounts([]);
      expect(result.size).toBe(0);
    });
  });

  describe("getPageSparkline", () => {
    it("should return sparkline data for a page", async () => {
      const { db } = await import("@/lib/db");
      
      const mockViewData = [
        { day: "2025-09-29", views: 10 },
        { day: "2025-09-30", views: 15 },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue(Promise.resolve(mockViewData)),
          }),
        }),
      });

      const result = await getPageSparkline("/", 3);

      expect(result).toHaveLength(3);
      expect(result.some(item => item.day === "2025-09-29" && item.views === 10)).toBe(true);
      expect(result.some(item => item.day === "2025-09-30" && item.views === 15)).toBe(true);
      // Should have zero views for days with no data
      expect(result.some(item => item.views === 0)).toBe(true);
    });

    it("should return zero views when daily table is missing", async () => {
      const { db } = await import("@/lib/db");
      
      const error = new Error("relation \"page_daily_views\" does not exist") as any;
      error.code = "42P01";
      
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(error),
          }),
        }),
      });

      const result = await getPageSparkline("/test", 2);

      expect(result).toHaveLength(2);
      expect(result.every(item => item.views === 0)).toBe(true);
    });
  });
});