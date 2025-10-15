// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as redirectsGet } from "@/app/api/redirects/route";

const mockGetRedirects = vi.fn();

vi.mock("@/lib/redirects", () => ({
  getRedirects: (...args: unknown[]) => mockGetRedirects(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    warn: vi.fn(),
  },
}));

describe("/api/redirects", () => {
  beforeEach(() => {
    mockGetRedirects.mockReset();
  });

  it("returns redirects with cache headers", async () => {
    mockGetRedirects.mockResolvedValue([{ from: "/old", to: "/new" }]);

    const response = await redirectsGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([{ from: "/old", to: "/new" }]);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30, s-maxage=30");
  });

  it("returns empty list when redirect loading fails", async () => {
    mockGetRedirects.mockRejectedValue(new Error("database down"));

    const response = await redirectsGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([]);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=5, s-maxage=5");
  });
});
