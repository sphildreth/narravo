// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST as purgePostHandler } from "@/app/api/admin/purge/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dataOperationLogs, posts, comments } from "@/drizzle/schema";

// Mock db and auth
vi.mock("@/lib/db");
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ user: { id: "u1", isAdmin: true } }) }));

const requireAdminMock = requireAdmin as unknown as Mock;

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/admin/purge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "vitest",
    },
    body: JSON.stringify(payload),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ user: { id: "u1", isAdmin: true } });
});

describe("/api/admin/purge — hard delete", () => {
  it("rejects hard delete without correct confirmation phrase", async () => {
    // Arrange: mock audit log insert
    (db as any).insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "log-1" }]) })),
    }));

    const req = makeRequest({ type: "post", mode: "hard", dryRun: false, id: "11111111-1111-4111-8111-111111111111", confirmationPhrase: "WRONG" });

    // Act
    const res = await purgePostHandler(req as any);
    const json = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.message).toMatch(/Hard delete requires confirmation phrase/);
  });

  it("performs hard delete by id with no preview when confirmation is correct", async () => {
    const id = "22222222-2222-4222-8222-222222222222";

    // 1) Audit log insert
    (db as any).insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "log-2" }]) })),
    }));

    // 2) Select posts to delete and cascade counts
    ;(db as any).select = vi.fn(() => ({
      from: (tbl: any) => ({
        where: vi.fn().mockImplementation(async () => {
          if (tbl === posts) {
            return [{ id, slug: "post-slug", title: "Hello", createdAt: new Date() }];
          }
          if (tbl === comments) {
            return [{ count: 0 }];
          }
          return [];
        }),
      }),
    }));

    // 3) Hard delete call
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    (db as any).delete = vi.fn(() => ({ where: deleteWhere }));

    // 4) Audit log update
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    (db as any).update = vi.fn(() => ({ set: updateSet }));

    const req = makeRequest({ type: "post", mode: "hard", dryRun: false, id, confirmationPhrase: `DELETE post ${id}` });

    const res = await purgePostHandler(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.dryRun).toBe(false);
    expect(json.recordsAffected).toBe(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    // Ensure we attempted to update the audit log
    expect(updateSet).toHaveBeenCalled();
    expect(updateWhere).toHaveBeenCalled();
  });

  it("returns preview results without mutating data when running a dry run", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const now = new Date("2024-05-15T10:00:00Z");

    (db as any).insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "log-3" }]) })),
    }));

    const selectPostsWhere = vi.fn().mockResolvedValue([
      {
        id,
        slug: "preview-post",
        title: "Preview Post",
        createdAt: now,
        featuredImageUrl: null,
        bodyHtml: "<p>preview body</p>",
        html: "<p>preview html</p>",
      },
    ]);

    const selectCommentsWhere = vi.fn().mockResolvedValue([{ count: 2 }]);

    (db as any).select = vi
      .fn()
      .mockImplementationOnce(() => ({
        from: (tbl: unknown) => {
          expect(tbl).toBe(posts);
          return { where: selectPostsWhere };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (tbl: unknown) => {
          expect(tbl).toBe(comments);
          return { where: selectCommentsWhere };
        },
      }));

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    (db as any).update = vi.fn((table: unknown) => {
      expect(table).toBe(dataOperationLogs);
      return { set: updateSet };
    });

    const deleteWhere = vi.fn();
    (db as any).delete = vi.fn(() => ({ where: deleteWhere }));

    const req = makeRequest({ type: "post", mode: "soft", dryRun: true, id });

    const res = await purgePostHandler(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.dryRun).toBe(true);
    expect(json.recordsAffected).toBe(1);
    expect(json.preview.records).toEqual([
      expect.objectContaining({
        id,
        slug: "preview-post",
        title: "Preview Post",
      }),
    ]);
    expect(json.preview.cascadeEffects).toEqual({ comments: 2 });
    expect(deleteWhere).not.toHaveBeenCalled();
    expect((db as any).delete).toHaveBeenCalledTimes(0);
    expect((db as any).update).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
  });

  it("returns 403 when admin authentication fails", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Forbidden"));

    const res = await purgePostHandler(
      makeRequest({ type: "post", mode: "soft", dryRun: true }) as any
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe("Forbidden");
  });
});
