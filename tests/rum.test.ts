// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as rumPostHandler } from "@/app/api/rum/route";

// Mock next/headers to control DNT and IP headers
const mockHeaderStore: Record<string, string | undefined> = {};
vi.mock("next/headers", () => ({
  headers: () => ({
    get: (key: string) => mockHeaderStore[key.toLowerCase()] ?? null,
  }),
}));

function makeRequest(payload?: unknown): any {
  return new Request("http://localhost/api/rum", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : null,
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaderStore["dnt"] = "0"; // default allow
  mockHeaderStore["x-forwarded-for"] = "127.0.0.1";
  // Ensure full sampling for deterministic tests
  process.env.RUM_SAMPLING_RATE = "1.0";
});

describe("/api/rum", () => {
  it("returns 204 (no content) immediately when DNT=1", async () => {
    mockHeaderStore["dnt"] = "1";

    const res = await rumPostHandler(makeRequest() as any);
    expect(res.status).toBe(204);
  });

  it("rejects invalid payload with 400", async () => {
    const res = await rumPostHandler(makeRequest({ foo: "bar" }) as any);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Invalid payload");
  });

  it("accepts valid payload and returns 204", async () => {
    const payload = {
      url: "https://example.com/some/page?query=1#hash",
      metrics: [
        { name: "LCP", value: 1234 },
        { name: "CLS", value: 0.02 },
      ],
      deviceType: "desktop",
      timestamp: Date.now(),
    } satisfies any;

    const res = await rumPostHandler(makeRequest(payload) as any);
    expect(res.status).toBe(204);
  });
});
