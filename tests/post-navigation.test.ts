// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from "vitest";
import { getPreviousPost, getNextPost } from "@/lib/posts";
import { db } from "@/lib/db";

// Mock the database
vi.mock("@/lib/db");

describe("Post Navigation", () => {
  describe("getPreviousPost", () => {
    it("should return previous post based on publishedAt", async () => {
      const mockRows = [{ id: "prev-id", slug: "prev-post", title: "Previous Post" }];
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await getPreviousPost("current-id");

      expect(result).toEqual({
        id: "prev-id",
        slug: "prev-post", 
        title: "Previous Post"
      });
    });

    it("should return null when no previous post exists", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as any);

      const result = await getPreviousPost("current-id");

      expect(result).toBeNull();
    });
  });

  describe("getNextPost", () => {
    it("should return next post based on publishedAt", async () => {
      const mockRows = [{ id: "next-id", slug: "next-post", title: "Next Post" }];
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await getNextPost("current-id");

      expect(result).toEqual({
        id: "next-id",
        slug: "next-post",
        title: "Next Post"
      });
    });

    it("should return null when no next post exists", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as any);

      const result = await getNextPost("current-id");

      expect(result).toBeNull();
    });
  });
});