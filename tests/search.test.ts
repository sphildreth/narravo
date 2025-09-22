// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { execute: vi.fn() },
}));

describe("searchPosts", () => {
  beforeEach(async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.execute).mockReset();
  });

  it("validates min query length", async () => {
    const { searchPosts } = await import("@/lib/search");
    await expect(searchPosts({ q: "a" })).rejects.toThrow();
  });

  it("returns items ordered by title match score first", async () => {
    const { db } = await import("@/lib/db");
    const now = new Date().toISOString();
    // Mock two rows where first has higher score; order should be preserved
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [
      { id: "1", slug: "t1", title: "Alpha", excerpt: null, publishedAt: now, score: 2 },
      { id: "2", slug: "t2", title: "Beta", excerpt: null, publishedAt: now, score: 1 },
    ] } as any);

    const { searchPosts } = await import("@/lib/search");
  const res = await searchPosts({ q: "ab", page: 1, pageSize: 10 });
    expect(res.items.map(i => i.id)).toEqual(["1", "2"]);
    expect(res.pagination.hasMore).toBe(false);
  });

  it("sets hasMore when more than page size rows", async () => {
    const { db } = await import("@/lib/db");
    const rows = Array.from({ length: 6 }).map((_, i) => ({ id: String(i+1), slug: `s${i+1}`, title: `T${i+1}`, excerpt: null, publishedAt: new Date().toISOString(), score: 1 }));
    // Return pageSize+1 rows
    vi.mocked(db.execute).mockResolvedValueOnce({ rows } as any);
    const { searchPosts } = await import("@/lib/search");
    const res = await searchPosts({ q: "ab", page: 1, pageSize: 5 });
    expect(res.items).toHaveLength(5);
    expect(res.pagination.hasMore).toBe(true);
  });
});
