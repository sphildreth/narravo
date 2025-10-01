import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

describe("lib/redirectsEdge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // @ts-expect-error allow cleanup
      delete global.fetch;
    }
  });

  it("fetches redirects from API", async () => {
    const json = vi.fn().mockResolvedValue([{ fromPath: "/old", toPath: "/new" }]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    global.fetch = fetchMock as any;

    const { getRedirectsEdge } = await import("@/lib/redirectsEdge");

    const request = { url: "https://example.com/path" } as any;
    const redirects = await getRedirectsEdge(request);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/api/redirects", { cache: "no-store" });
    expect(redirects).toEqual([{ fromPath: "/old", toPath: "/new" }]);
  });

  it("returns empty array when response not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    global.fetch = fetchMock as any;

    const { getRedirectsEdge } = await import("@/lib/redirectsEdge");

    const result = await getRedirectsEdge({ url: "https://example.com" } as any);
    expect(result).toEqual([]);
  });

  it("guards against non-array JSON payloads", async () => {
    const json = vi.fn().mockResolvedValue({ not: "an array" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    global.fetch = fetchMock as any;

    const { getRedirectsEdge } = await import("@/lib/redirectsEdge");
    const result = await getRedirectsEdge({ url: "https://example.com" } as any);
    expect(result).toEqual([]);
  });

  it("returns empty array when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    global.fetch = fetchMock as any;

    const { getRedirectsEdge } = await import("@/lib/redirectsEdge");
    const result = await getRedirectsEdge({ url: "https://example.com" } as any);
    expect(result).toEqual([]);
  });
});
