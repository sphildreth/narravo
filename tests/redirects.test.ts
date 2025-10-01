import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = { ...process.env };

describe("lib/redirects", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it("returns redirects from DB rows", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ fromPath: "/old", toPath: "/new" }] });
    vi.doMock("@/lib/db", () => ({ db: { execute } }));
    vi.doMock("@/drizzle/schema", () => ({ redirects: Symbol("redirects"), }));
    const warn = vi.fn();
    vi.doMock("@/lib/logger", () => ({ default: { warn } }));

    const { getRedirects } = await import("@/lib/redirects");

    await expect(getRedirects()).resolves.toEqual([{ fromPath: "/old", toPath: "/new" }]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("normalizes array-like results", async () => {
    const execute = vi.fn().mockResolvedValue([
      { fromPath: "/a", toPath: "/b" },
    ]);
    vi.doMock("@/lib/db", () => ({ db: { execute } }));
    vi.doMock("@/drizzle/schema", () => ({ redirects: Symbol("redirects"), }));
    vi.doMock("@/lib/logger", () => ({ default: { warn: vi.fn() } }));

    const { getRedirects } = await import("@/lib/redirects");

    await expect(getRedirects()).resolves.toEqual([{ fromPath: "/a", toPath: "/b" }]);
  });

  it("returns empty array and logs when DB fails", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("DB down"));
    vi.doMock("@/lib/db", () => ({ db: { execute } }));
    vi.doMock("@/drizzle/schema", () => ({ redirects: Symbol("redirects"), }));
    const warn = vi.fn();
    vi.doMock("@/lib/logger", () => ({ default: { warn } }));

    process.env = { ...process.env, NODE_ENV: "production" };

    const { getRedirects } = await import("@/lib/redirects");

    await expect(getRedirects()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith("Redirects: DB unavailable, returning empty list");
  });
});
