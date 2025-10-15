// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/metrics/view/route";

const mockRecordView = vi.fn();
const mockRecordPageView = vi.fn();
const mockGetBoolean = vi.fn();

const mockConfig = {
  getBoolean: mockGetBoolean,
};

const ConfigServiceImpl = vi.fn(() => mockConfig);

vi.mock("@/lib/analytics", () => ({
  recordView: (...args: unknown[]) => mockRecordView(...args),
  recordPageView: (...args: unknown[]) => mockRecordPageView(...args),
}));

vi.mock("@/lib/config", () => ({
  get ConfigServiceImpl() {
    return ConfigServiceImpl;
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockResponseJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

describe("/api/metrics/view endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordView.mockResolvedValue(true);
    mockRecordPageView.mockResolvedValue(true);
    mockGetBoolean.mockResolvedValue(false);
    ConfigServiceImpl.mockClear();
    ConfigServiceImpl.mockImplementation(() => mockConfig);
  });

  describe("POST - post view tracking", () => {
    it("should record a post view with valid postId", async () => {
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "550e8400-e29b-41d4-a716-446655440000",
        })
      );
    });

    it("should include sessionId if provided", async () => {
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: "session-abc123",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "550e8400-e29b-41d4-a716-446655440000",
          sessionId: "session-abc123",
        })
      );
    });

    it("should extract IP from x-forwarded-for header", async () => {
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "550e8400-e29b-41d4-a716-446655440000",
          ip: "192.168.1.1", // First IP in the list
        })
      );
    });

    it("should extract IP from x-real-ip header if x-forwarded-for not present", async () => {
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-real-ip": "192.168.1.1",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "550e8400-e29b-41d4-a716-446655440000",
          ip: "192.168.1.1",
        })
      );
    });

    it("should include user-agent, referer, and accept-language headers", async () => {
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          referer: "https://google.com/search",
          "accept-language": "en-US,en;q=0.9",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "550e8400-e29b-41d4-a716-446655440000",
          ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          referer: "https://google.com/search",
          lang: "en-US,en;q=0.9",
        })
      );
    });

    it("should return 400 for invalid postId format", async () => {
      const body = JSON.stringify({
        postId: "not-a-uuid",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordView).not.toHaveBeenCalled();
    });

    it("should return 400 for missing postId", async () => {
      const body = JSON.stringify({
        sessionId: "session-abc123",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordView).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid JSON", async () => {
      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "invalid json {",
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordView).not.toHaveBeenCalled();
    });
  });

  describe("POST - page view tracking", () => {
    it("should record a page view with valid path", async () => {
      const body = JSON.stringify({
        type: "page",
        path: "/about",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/about",
        })
      );
    });

    it("should include sessionId for page views", async () => {
      const body = JSON.stringify({
        type: "page",
        path: "/contact",
        sessionId: "session-xyz789",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/contact",
          sessionId: "session-xyz789",
        })
      );
    });

    it("should include request context for page views", async () => {
      const body = JSON.stringify({
        type: "page",
        path: "/blog",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0",
          referer: "https://example.com",
          "accept-language": "en-US",
          "x-real-ip": "203.0.113.1",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/blog",
          ua: "Mozilla/5.0",
          referer: "https://example.com",
          lang: "en-US",
          ip: "203.0.113.1",
        })
      );
    });

    it("should return 400 for page view without path", async () => {
      const body = JSON.stringify({
        type: "page",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordPageView).not.toHaveBeenCalled();
    });
  });

  describe("DNT (Do Not Track) handling", () => {
    it("should respect DNT header when VIEW.RESPECT-DNT is enabled", async () => {
      mockGetBoolean.mockResolvedValue(true); // Enable DNT respect

      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          dnt: "1",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockGetBoolean).toHaveBeenCalledWith("VIEW.RESPECT-DNT");
      expect(mockRecordView).not.toHaveBeenCalled();
    });

    it("should track views when DNT is not set even if respect enabled", async () => {
      mockGetBoolean.mockResolvedValue(true); // Enable DNT respect

      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalled();
    });

    it("should track views when DNT respect is disabled", async () => {
      mockGetBoolean.mockResolvedValue(false); // Disable DNT respect

      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          dnt: "1",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 204 even when recordView fails", async () => {
      mockRecordView.mockRejectedValue(new Error("Database error"));

      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      // Should still return 204 to avoid impacting UX
      expect(response.status).toBe(204);
    });

    it("should return 204 even when recordPageView fails", async () => {
      mockRecordPageView.mockRejectedValue(new Error("Database error"));

      const body = JSON.stringify({
        type: "page",
        path: "/about",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      // Should still return 204 to avoid impacting UX
      expect(response.status).toBe(204);
    });

    it("should handle config service errors gracefully", async () => {
      mockGetBoolean.mockRejectedValue(new Error("Config error"));

      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      // Should still attempt to process (error caught internally)
      expect(response.status).toBe(204);
    });
  });

  describe("sessionId validation", () => {
    it("should reject sessionId longer than 128 characters", async () => {
      const longSessionId = "a".repeat(129);
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: longSessionId,
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordView).not.toHaveBeenCalled();
    });

    it("should accept sessionId exactly 128 characters", async () => {
      const validSessionId = "a".repeat(128);
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: validSessionId,
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordView).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: validSessionId,
        })
      );
    });

    it("should reject empty sessionId", async () => {
      const body = JSON.stringify({
        postId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: "",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordView).not.toHaveBeenCalled();
    });
  });

  describe("path validation for page views", () => {
    it("should reject path longer than 255 characters", async () => {
      const longPath = "/" + "a".repeat(255);
      const body = JSON.stringify({
        type: "page",
        path: longPath,
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordPageView).not.toHaveBeenCalled();
    });

    it("should accept path exactly 255 characters", async () => {
      const validPath = "/" + "a".repeat(254);
      const body = JSON.stringify({
        type: "page",
        path: validPath,
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(204);
      expect(mockRecordPageView).toHaveBeenCalledWith(
        expect.objectContaining({
          path: validPath,
        })
      );
    });

    it("should reject empty path", async () => {
      const body = JSON.stringify({
        type: "page",
        path: "",
      });

      const request = new Request("http://localhost:3000/api/metrics/view", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      }) as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await mockResponseJson(response);
      expect(json).toEqual({ error: "Invalid input" });
      expect(mockRecordPageView).not.toHaveBeenCalled();
    });
  });
});
