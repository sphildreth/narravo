// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as rumPostHandler } from "@/app/api/rum/route";

const mockConsumeSharedRateLimit = vi.fn();
vi.mock("@/lib/shared-rate-limit", () => ({
  consumeSharedRateLimit: (...args: unknown[]) => mockConsumeSharedRateLimit(...args),
}));

function makeRequest(payload?: unknown, headers: Record<string, string> = {}): any {
  return new Request("http://localhost/api/rum", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: payload ? JSON.stringify(payload) : null,
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConsumeSharedRateLimit.mockResolvedValue({ limited: false, remaining: 599, resetAt: new Date() });
  // Ensure full sampling for deterministic tests
  process.env.RUM_SAMPLING_RATE = "1.0";
});

describe("/api/rum", () => {
  it("returns 204 (no content) immediately when DNT=1", async () => {
    const res = await rumPostHandler(makeRequest(undefined, { dnt: "1" }) as any);
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
