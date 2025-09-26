// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as purgePostHandler } from "@/app/api/admin/purge/route";
import { db } from "@/lib/db";
import { posts, comments, commentAttachments } from "@/drizzle/schema";
import { localStorageService } from "@/lib/local-storage";

// Mock db and auth
vi.mock("@/lib/db");
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ user: { id: "admin-1", isAdmin: true } }) }));

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/admin/purge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }) as any;
}

describe("/api/admin/purge — hard delete removes imported-media files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes imported-media files referenced by posts and comment attachments", async () => {
    const id = "33333333-3333-4333-8333-333333333333";

    // Spy on local storage delete calls (fallback when S3 not configured)
    const delSpy = vi.spyOn(localStorageService, "deleteObject").mockResolvedValue();

    // 1) Audit log insert
    (db as any).insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "log-3" }]) })),
    }));

    // 2) Select posts to delete, comments count, and attachments for those posts
    (db as any).select = vi.fn(() => ({
      from: (tbl: any) => ({
        where: vi.fn().mockImplementation(async () => {
          if (tbl === posts) {
            return [{
              id,
              slug: "post-slug",
              title: "Hello",
              createdAt: new Date(),
              featuredImageUrl: "/uploads/imported-media/foo.jpg",
              bodyHtml: '<img src="/uploads/imported-media/bar.png" />',
              html: 'https://storage.example.com/bucket/imported-media/baz.webm',
            }];
          }
          if (tbl === comments) {
            // Comments count query
            return [{ count: 0 }];
          }
          if (tbl === commentAttachments) {
            // Attachments joined to comments for these posts
            return [
              { url: "/uploads/imported-media/qux.gif", posterUrl: null },
              { url: "https://cdn.example.com/x/imported-media/norf.webp", posterUrl: "/uploads/imported-media/poster.jpg" },
            ];
          }
          return [];
        }),
        leftJoin: vi.fn().mockReturnThis(),
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
    expect(deleteWhere).toHaveBeenCalledTimes(1);

    // Ensure imported-media keys were targeted for deletion
    const calls = delSpy.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(expect.arrayContaining([
      "imported-media/foo.jpg",
      "imported-media/bar.png",
      "imported-media/baz.webm",
      "imported-media/qux.gif",
      "imported-media/norf.webp",
      "imported-media/poster.jpg",
    ]));
    expect(delSpy).toHaveBeenCalled();
  });
});
