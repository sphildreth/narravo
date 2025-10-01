import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = { ...process.env };

describe("lib/db", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it("throws when DATABASE_URL is missing", async () => {
    const logSlowQuery = vi.fn();
    vi.doMock("@/lib/performance", () => ({ logSlowQuery }));
    vi.doMock("pg", () => ({ Pool: vi.fn() }));
    vi.doMock("drizzle-orm/node-postgres", () => ({ drizzle: vi.fn() }));

    process.env.NARRAVO_DISABLE_DB = "true";
    const mod = await import("@/lib/db");
    delete process.env.NARRAVO_DISABLE_DB;

    expect(mod.pool).toBeNull();
    expect(() => (mod.db as any).select).toThrowError(/Database is not configured/);
    expect(logSlowQuery).not.toHaveBeenCalled();
  });

  it("wraps pool.query to log slow queries (promise API)", async () => {
    process.env = { ...process.env, DATABASE_URL: "postgres://example", NODE_ENV: "development" };

    const logSlowQuery = vi.fn();
    const underlyingQuery = vi.fn().mockResolvedValue({ rows: [] });
    const poolInstance = { query: underlyingQuery } as any;
    const poolCtor = vi.fn(() => poolInstance);
    const drizzleMock = vi.fn(() => ({ execute: vi.fn() }));

    vi.doMock("@/lib/performance", () => ({ logSlowQuery }));
    vi.doMock("pg", () => ({ Pool: poolCtor }));
    vi.doMock("drizzle-orm/node-postgres", () => ({ drizzle: drizzleMock }));

    const { pool } = await import("@/lib/db");

    expect(pool).toBe(poolInstance);
    expect(poolCtor).toHaveBeenCalledWith({ connectionString: "postgres://example" });
    expect(drizzleMock).toHaveBeenCalledWith(poolInstance);

    const result = await pool.query("select 1");
    expect(result).toEqual({ rows: [] });
    expect(underlyingQuery).toHaveBeenCalledWith("select 1");
    expect(logSlowQuery).toHaveBeenCalledWith("select 1", expect.any(Number));
  });

  it("supports callback style queries", async () => {
    process.env = { ...process.env, DATABASE_URL: "postgres://example", NODE_ENV: "development" };

    const logSlowQuery = vi.fn();
    const underlyingQuery = vi.fn((text: any, params: any, callback: any) => {
      callback(null, { ok: true });
    });
    const poolInstance = { query: underlyingQuery } as any;
    const poolCtor = vi.fn(() => poolInstance);

    vi.doMock("@/lib/performance", () => ({ logSlowQuery }));
    vi.doMock("pg", () => ({ Pool: poolCtor }));
    vi.doMock("drizzle-orm/node-postgres", () => ({ drizzle: vi.fn(() => ({ execute: vi.fn() })) }));

    const { pool } = await import("@/lib/db");

    const callback = vi.fn();
    pool.query("select", callback);

    expect(underlyingQuery).toHaveBeenCalledWith("select", undefined, expect.any(Function));
    expect(callback).toHaveBeenCalledWith(null, { ok: true });
    expect(logSlowQuery).toHaveBeenCalledWith("select", expect.any(Number));
  });

  it("skips wrapping query in test environment", async () => {
    process.env = { ...process.env, DATABASE_URL: "postgres://example", NODE_ENV: "test" };

    const underlyingQuery = vi.fn().mockResolvedValue("ok");
    const poolInstance = { query: underlyingQuery } as any;

    vi.doMock("@/lib/performance", () => ({ logSlowQuery: vi.fn() }));
    vi.doMock("pg", () => ({ Pool: vi.fn(() => poolInstance) }));
    vi.doMock("drizzle-orm/node-postgres", () => ({ drizzle: vi.fn(() => ({ execute: vi.fn() })) }));

    const { pool } = await import("@/lib/db");

    expect(pool.query).toBe(underlyingQuery);
  });
});
