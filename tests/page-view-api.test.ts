// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as viewApiHandler } from "@/app/api/metrics/view/route";

// Mock the analytics module
vi.mock("@/lib/analytics", () => ({
  recordView: vi.fn(),
  recordPageView: vi.fn(),
}));

// Mock the config module
vi.mock("@/lib/config", () => ({
  ConfigServiceImpl: vi.fn().mockImplementation(() => ({
    getBoolean: vi.fn().mockResolvedValue(false),
  })),
}));

// Mock the logger module
vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeRequest(payload?: unknown, headers: Record<string, string> = {}): any {
  return {
    json: () => Promise.resolve(payload),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("/api/metrics/view", () => {
  describe("Page View Tracking", () => {
    it("should record a page view successfully", async () => {
      const { recordPageView } = await import("@/lib/analytics");
      (recordPageView as any).mockResolvedValue(true);

      const request = makeRequest({
        type: "page",
        path: "/",
        sessionId: "test-session-123",
      }, {
        "user-agent": "Mozilla/5.0 Test Browser",
        "referer": "https://google.com",
        "accept-language": "en-US,en;q=0.9",
        "x-forwarded-for": "192.168.1.1",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(204);
      expect(recordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/",
          sessionId: "test-session-123",
          ip: "192.168.1.1",
          ua: "Mozilla/5.0 Test Browser",
          referer: "https://google.com",
          lang: "en-US,en;q=0.9",
        })
      );
    });

    it("should validate page path", async () => {
      const request = makeRequest({
        type: "page",
        path: "", // Invalid empty path
        sessionId: "test-session",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(400);
    });

    it("should handle long paths", async () => {
      const longPath = "/" + "a".repeat(300); // Exceeds 255 char limit
      
      const request = makeRequest({
        type: "page",
        path: longPath,
        sessionId: "test-session",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe("Post View Tracking (Legacy Support)", () => {
    it("should still support legacy post view format", async () => {
      const { recordView } = await import("@/lib/analytics");
      (recordView as any).mockResolvedValue(true);

      const request = makeRequest({
        postId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: "test-session-123",
      }, {
        "user-agent": "Mozilla/5.0 Test Browser",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(204);
      expect(recordView).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "550e8400-e29b-41d4-a716-446655440000",
          sessionId: "test-session-123",
        })
      );
    });

    it("should validate post UUID format", async () => {
      const request = makeRequest({
        postId: "invalid-uuid",
        sessionId: "test-session",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe("DNT (Do Not Track) Support", () => {
    it("should respect DNT header when configured", async () => {
      // Update the global mock for ConfigServiceImpl to respect DNT
      const { ConfigServiceImpl } = await import("@/lib/config");
      
      // Clear all mocks and set up fresh mocks
      vi.clearAllMocks();
      vi.resetModules();
      
      // Mock the ConfigServiceImpl constructor to return an instance with DNT enabled
      (ConfigServiceImpl as any).mockImplementation(() => ({
        getBoolean: vi.fn().mockImplementation((key: string) => {
          if (key === "VIEW.RESPECT-DNT") return Promise.resolve(true);
          return Promise.resolve(false);
        }),
      }));

      const request = makeRequest({
        type: "page",
        path: "/privacy-test",
      }, {
        "dnt": "1",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(204);
      
      // Import the module to check the mock
      const analytics = await import("@/lib/analytics");
      
      // The function should return early due to DNT, so recordPageView should not be called
      expect(analytics.recordPageView).not.toHaveBeenCalled();
    });
  });

  describe("IP Address Handling", () => {
    it("should extract IP from X-Forwarded-For header", async () => {
      const { recordPageView } = await import("@/lib/analytics");
      (recordPageView as any).mockResolvedValue(true);

      const request = makeRequest({
        type: "page",
        path: "/ip-test",
      }, {
        "x-forwarded-for": "203.0.113.42, 192.168.1.1, 10.0.0.1",
      });

      await viewApiHandler(request);

      expect(recordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: "203.0.113.42", // First IP in the list
        })
      );
    });

    it("should fallback to X-Real-IP header", async () => {
      const { recordPageView } = await import("@/lib/analytics");
      (recordPageView as any).mockResolvedValue(true);

      const request = makeRequest({
        type: "page",
        path: "/ip-fallback-test",
      }, {
        "x-real-ip": "198.51.100.42",
      });

      await viewApiHandler(request);

      expect(recordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: "198.51.100.42",
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should return 204 even when analytics fail", async () => {
      const { recordPageView } = await import("@/lib/analytics");
      (recordPageView as any).mockRejectedValue(new Error("Database connection failed"));

      const request = makeRequest({
        type: "page",
        path: "/error-test",
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(204);
    });

    it("should handle invalid JSON gracefully", async () => {
      const request = makeRequest(undefined); // Will cause JSON parsing to fail
      request.json = () => Promise.reject(new Error("Invalid JSON"));

      const response = await viewApiHandler(request as any);

      expect(response.status).toBe(400);
    });
  });

  describe("Session ID Validation", () => {
    it("should accept valid session IDs", async () => {
      const { recordPageView } = await import("@/lib/analytics");
      (recordPageView as any).mockResolvedValue(true);

      const validSessionId = "a".repeat(32); // 32 character session ID
      
      const request = makeRequest({
        type: "page",
        path: "/session-test",
        sessionId: validSessionId,
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(204);
      expect(recordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: validSessionId,
        })
      );
    });

    it("should reject session IDs that are too long", async () => {
      const tooLongSessionId = "a".repeat(200); // Exceeds 128 char limit
      
      const request = makeRequest({
        type: "page",
        path: "/session-validation-test",
        sessionId: tooLongSessionId,
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(400);
    });

    it("should allow missing session ID", async () => {
      const { recordPageView } = await import("@/lib/analytics");
      (recordPageView as any).mockResolvedValue(true);

      const request = makeRequest({
        type: "page",
        path: "/no-session-test",
        // sessionId omitted
      });

      const response = await viewApiHandler(request);

      expect(response.status).toBe(204);
      expect(recordPageView).toHaveBeenCalledWith(
        expect.not.objectContaining({
          sessionId: expect.anything(),
        })
      );
    });
  });
});