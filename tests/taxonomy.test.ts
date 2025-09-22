// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from "vitest";
import { upsertTag, upsertCategory, getTagBySlug, getCategoryBySlug } from "@/lib/taxonomy";
import { db } from "@/lib/db";

// Mock the database
vi.mock("@/lib/db");

describe("Taxonomy Functions", () => {
  describe("upsertTag", () => {
    it("should return existing tag if found", async () => {
      const mockTag = { 
        id: "tag-id", 
        name: "Test Tag", 
        slug: "test-tag", 
        createdAt: new Date() 
      };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTag])
          })
        })
      } as any);

      const result = await upsertTag("Test Tag");

      expect(result).toEqual({
        id: "tag-id",
        name: "Test Tag",
        slug: "test-tag",
        createdAt: mockTag.createdAt.toISOString(),
      });
    });

    it("should create new tag if not found", async () => {
      const mockNewTag = {
        id: "new-tag-id",
        name: "New Tag",
        slug: "new-tag",
        createdAt: new Date()
      };

      // Mock empty result for select (tag not found)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      // Mock insert returning new tag
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewTag])
        })
      } as any);

      const result = await upsertTag("New Tag");

      expect(result).toEqual({
        id: "new-tag-id",
        name: "New Tag",
        slug: "new-tag",
        createdAt: mockNewTag.createdAt.toISOString(),
      });
    });
  });

  describe("getTagBySlug", () => {
    it("should return tag if found", async () => {
      const mockTag = {
        id: "tag-id",
        name: "Test Tag",
        slug: "test-tag",
        createdAt: new Date()
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTag])
          })
        })
      } as any);

      const result = await getTagBySlug("test-tag");

      expect(result).toEqual({
        id: "tag-id",
        name: "Test Tag",
        slug: "test-tag",
        createdAt: mockTag.createdAt.toISOString(),
      });
    });

    it("should return null if not found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      const result = await getTagBySlug("nonexistent-tag");

      expect(result).toBeNull();
    });
  });

  describe("getCategoryBySlug", () => {
    it("should return category if found", async () => {
      const mockCategory = {
        id: "cat-id",
        name: "Test Category",
        slug: "test-category",
        createdAt: new Date()
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCategory])
          })
        })
      } as any);

      const result = await getCategoryBySlug("test-category");

      expect(result).toEqual({
        id: "cat-id",
        name: "Test Category",
        slug: "test-category",
        createdAt: mockCategory.createdAt.toISOString(),
      });
    });

    it("should return null if not found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      const result = await getCategoryBySlug("nonexistent-category");

      expect(result).toBeNull();
    });
  });
});