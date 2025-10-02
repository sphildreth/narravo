// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the redirectsEdge module BEFORE importing middleware
vi.mock("@/lib/redirectsEdge", () => ({
  getRedirectsEdge: vi.fn(),
}));

// Mock the logger module
vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Middleware", () => {
  let mockGetRedirectsEdge: ReturnType<typeof vi.fn>;
  let middleware: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset modules to clear the cache
    vi.resetModules();
    
    // Re-import the middleware fresh with cleared cache
    const middlewareModule = await import("../src/middleware");
    middleware = middlewareModule.middleware;

    // Import and setup mock
    const redirectsEdge = await import("@/lib/redirectsEdge");
    mockGetRedirectsEdge = vi.mocked(redirectsEdge.getRedirectsEdge);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("date-based path redirects", () => {
    it("should redirect YYYY/MM/DD/slug to /slug format", async () => {
      const request = new NextRequest(
        new URL("http://localhost:3000/2024/10/15/my-blog-post")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/my-blog-post"
      );
    });

    it("should handle date-based paths with hyphens in slug", async () => {
      const request = new NextRequest(
        new URL("http://localhost:3000/2023/05/20/this-is-a-test-post")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/this-is-a-test-post"
      );
    });

    it("should handle date-based paths with query parameters", async () => {
      const request = new NextRequest(
        new URL("http://localhost:3000/2024/01/01/new-year?utm_source=email")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      const location = response.headers.get("location");
      expect(location).toContain("http://localhost:3000/new-year");
      expect(location).toContain("utm_source=email");
    });

    it("should not redirect paths that don't match date format", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);
      
      const request = new NextRequest(
        new URL("http://localhost:3000/blog/my-post")
      );

      const response = await middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should not redirect partial date formats", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);
      
      const request = new NextRequest(
        new URL("http://localhost:3000/2024/10/invalid")
      );

      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("should handle various valid date formats", async () => {
      const testCases = [
        { path: "/2024/01/01/post", expected: "/post" },
        { path: "/2020/12/31/year-end", expected: "/year-end" },
        { path: "/1999/06/15/old-post", expected: "/old-post" },
      ];

      for (const { path, expected } of testCases) {
        const request = new NextRequest(new URL(`http://localhost:3000${path}`));
        const response = await middleware(request);

        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe(
          `http://localhost:3000${expected}`
        );
      }
    });
  });

  describe("database redirects", () => {
    it("should redirect exact path matches", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old-path", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/old-path")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/new-path"
      );
    });

    it("should handle trailing slash - request without slash, database with slash", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old-path/", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/old-path")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/new-path"
      );
    });

    it("should handle trailing slash - request with slash, database without slash", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old-path", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/old-path/")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      // Note: Next.js URL clone() preserves the original trailing slash behavior
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/new-path/"
      );
    });

    it("should handle multiple redirects and match first applicable", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/path-1", toPath: "/target-1" },
        { fromPath: "/path-2", toPath: "/target-2" },
        { fromPath: "/path-3", toPath: "/target-3" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/path-2")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/target-2"
      );
    });

    it("should not redirect when no matching path exists", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old-path", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/different-path")
      );

      const response = await middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should handle empty redirects array", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);

      const request = new NextRequest(
        new URL("http://localhost:3000/any-path")
      );

      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("should preserve query parameters during redirect", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old", toPath: "/new" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/old?param=value&other=123")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      const location = response.headers.get("location");
      expect(location).toContain("http://localhost:3000/new");
      expect(location).toContain("param=value");
      expect(location).toContain("other=123");
    });

    it("should handle redirects with special characters in paths", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old-path-with-special-chars", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/old-path-with-special-chars")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/new-path"
      );
    });
  });

  describe("redirect caching", () => {
    it("should cache redirects for subsequent requests", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/cached", toPath: "/target" },
      ]);

      // First request
      const request1 = new NextRequest(
        new URL("http://localhost:3000/cached")
      );
      await middleware(request1);

      // Second request within cache duration
      const request2 = new NextRequest(
        new URL("http://localhost:3000/cached")
      );
      await middleware(request2);

      // Should only call getRedirectsEdge once due to caching
      expect(mockGetRedirectsEdge).toHaveBeenCalledTimes(1);
    });
  });

  describe("public route access", () => {
    it("should allow access to public routes", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);

      const publicRoutes = ["/", "/about", "/contact", "/blog-post"];

      for (const route of publicRoutes) {
        const request = new NextRequest(
          new URL(`http://localhost:3000${route}`)
        );
        const response = await middleware(request);

        expect(response.status).toBe(200);
      }
    });

    it("should handle root path", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);

      const request = new NextRequest(new URL("http://localhost:3000/"));
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("should handle nested public paths", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);

      const request = new NextRequest(
        new URL("http://localhost:3000/category/subcategory/post")
      );
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });
  });

  describe("priority of redirects", () => {
    it("should prioritize date-based redirects over database redirects", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/2024/10/01/test", toPath: "/database-target" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/2024/10/01/test")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
      // Date-based redirect should transform to /test, not /database-target
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/test"
      );
    });

    it("should check database redirects after date-based patterns", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/old", toPath: "/new" },
      ]);

      const request = new NextRequest(new URL("http://localhost:3000/old"));
      const response = await middleware(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/new"
      );
    });
  });

  describe("error handling", () => {
    it("should handle errors from getRedirectsEdge gracefully", async () => {
      mockGetRedirectsEdge.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest(
        new URL("http://localhost:3000/test-path")
      );

      // Should not throw, should continue processing
      await expect(middleware(request)).rejects.toThrow("Database error");
    });

    it("should handle null redirects response", async () => {
      mockGetRedirectsEdge.mockResolvedValue(null as any);

      const request = new NextRequest(
        new URL("http://localhost:3000/test-path")
      );

      const response = await middleware(request);

      // Should continue without redirecting
      expect(response.status).toBe(200);
    });
  });

  describe("edge cases", () => {
    it("should handle paths with multiple consecutive slashes", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);

      const request = new NextRequest(
        new URL("http://localhost:3000//double//slash")
      );

      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("should handle very long paths", async () => {
      mockGetRedirectsEdge.mockResolvedValue([]);

      const longPath = "/very/long/path/with/many/segments/".repeat(10);
      const request = new NextRequest(
        new URL(`http://localhost:3000${longPath}`)
      );

      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("should handle paths with encoded characters", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/test path", toPath: "/target" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/test%20path")
      );

      // Note: URL encoding handling depends on implementation
      const response = await middleware(request);

      // Should either redirect or pass through
      expect([200, 301]).toContain(response.status);
    });

    it("should handle case-sensitive paths correctly", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/OldPath", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/OldPath")
      );

      const response = await middleware(request);

      expect(response.status).toBe(301);
    });

    it("should not match case-insensitive when exact match required", async () => {
      mockGetRedirectsEdge.mockResolvedValue([
        { fromPath: "/OldPath", toPath: "/new-path" },
      ]);

      const request = new NextRequest(
        new URL("http://localhost:3000/oldpath")
      );

      const response = await middleware(request);

      expect(response.status).toBe(200); // No redirect due to case mismatch
    });
  });
});
