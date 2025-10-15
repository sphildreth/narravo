// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/db");
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  auth: vi.fn(),
  authGet: vi.fn(),
  authPost: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { deletePostAction, canDeletePosts } from "@/app/actions/deletePost";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidateTag, revalidatePath } from "next/cache";
import logger from "@/lib/logger";

const requireAdminMock = requireAdmin as unknown as Mock;
const revalidateTagMock = revalidateTag as Mock;
const revalidatePathMock = revalidatePath as Mock;
const loggerErrorMock = logger.error as Mock;

function makeFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

describe("deletePost.ts - deletePostAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ user: { id: "admin-1", isAdmin: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("admin authorization", () => {
    it("should verify admin permissions before deletion", async () => {
      // Arrange
      const postId = "11111111-1111-4111-8111-111111111111";
      const formData = makeFormData({ id: postId });

      // Mock database operations
      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await deletePostAction(formData);

      // Assert
      expect(requireAdminMock).toHaveBeenCalledTimes(1);
    });

    it("should return error when user is not admin", async () => {
      // Arrange
      const postId = "11111111-1111-4111-8111-111111111111";
      const formData = makeFormData({ id: postId });

      requireAdminMock.mockRejectedValueOnce(new Error("Forbidden"));

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result).toEqual({
        error: "You don't have permission to delete posts",
      });
      expect(requireAdminMock).toHaveBeenCalledTimes(1);
    });

    it("should handle other errors during authorization", async () => {
      // Arrange
      const postId = "11111111-1111-4111-8111-111111111111";
      const formData = makeFormData({ id: postId });

      requireAdminMock.mockRejectedValueOnce(new Error("Database connection failed"));

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result).toEqual({
        error: "Failed to delete post",
      });
      expect(loggerErrorMock).toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    it("should validate post ID format", async () => {
      // Arrange
      const formData = makeFormData({ id: "not-a-uuid" });

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Invalid post ID");
    });

    it("should require post ID to be provided", async () => {
      // Arrange
      const formData = new FormData();

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result.error).toBeDefined();
    });

    it("should accept valid UUID format", async () => {
      // Arrange
      const postId = "22222222-2222-4222-8222-222222222222";
      const formData = makeFormData({ id: postId });

      // Mock database to return post not found
      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      }));

      // Act
      const result = await deletePostAction(formData);

      // Assert - should get past validation to post not found check
      expect(result.error).toBe("Post not found");
    });
  });

  describe("post existence validation", () => {
    it("should return error when post does not exist", async () => {
      // Arrange
      const postId = "33333333-3333-4333-8333-333333333333";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      }));

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result).toEqual({
        error: "Post not found",
      });
    });

    it("should proceed with deletion when post exists", async () => {
      // Arrange
      const postId = "44444444-4444-4444-8444-444444444444";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "existing-post", title: "Existing Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("successful deletion", () => {
    it("should delete post from database", async () => {
      // Arrange
      const postId = "55555555-5555-4555-8555-555555555555";
      const formData = makeFormData({ id: postId });

      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const deleteMock = vi.fn(() => ({ where: deleteWhere }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = deleteMock;

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(deleteMock).toHaveBeenCalled();
      expect(deleteWhere).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should return success message with post title", async () => {
      // Arrange
      const postId = "66666666-6666-4666-8666-666666666666";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "my-post", title: "My Awesome Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Post "My Awesome Post" deleted successfully',
      });
    });

    it("should handle cascade deletion of related data", async () => {
      // Arrange - The cascade happens via database foreign key constraints
      const postId = "77777777-7777-4777-8777-777777777777";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "post-with-comments", title: "Post with Comments" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      const result = await deletePostAction(formData);

      // Assert - Cascade is handled by database, we just verify deletion succeeds
      expect(result.success).toBe(true);
    });
  });

  describe("cache revalidation", () => {
    it("should revalidate home page cache", async () => {
      // Arrange
      const postId = "88888888-8888-4888-8888-888888888888";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await deletePostAction(formData);

      // Assert
      expect(revalidateTagMock).toHaveBeenCalledWith("home");
    });

    it("should revalidate post-specific cache", async () => {
      // Arrange
      const postId = "99999999-9999-4999-8999-999999999999";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await deletePostAction(formData);

      // Assert
      expect(revalidateTagMock).toHaveBeenCalledWith(`post:${postId}`);
    });

    it("should revalidate admin posts list path", async () => {
      // Arrange
      const postId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await deletePostAction(formData);

      // Assert
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/posts");
    });

    it("should revalidate post detail page path", async () => {
      // Arrange
      const postId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const postSlug = "my-awesome-post";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: postSlug, title: "My Awesome Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await deletePostAction(formData);

      // Assert
      expect(revalidatePathMock).toHaveBeenCalledWith(`/${postSlug}`);
    });

    it("should call all revalidation functions", async () => {
      // Arrange
      const postId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      // Act
      await deletePostAction(formData);

      // Assert
      expect(revalidateTagMock).toHaveBeenCalledTimes(2); // home and post:id
      expect(revalidatePathMock).toHaveBeenCalledTimes(2); // admin/posts and /{slug}
    });
  });

  describe("error handling", () => {
    it("should log errors to logger", async () => {
      // Arrange
      const postId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      const dbError = new Error("Database connection lost");
      (db as any).delete = vi.fn(() => {
        throw dbError;
      });

      // Act
      await deletePostAction(formData);

      // Assert
      expect(loggerErrorMock).toHaveBeenCalledWith("Error deleting post:", dbError);
    });

    it("should return generic error message on database failure", async () => {
      // Arrange
      const postId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => {
        throw new Error("Database error");
      });

      // Act
      const result = await deletePostAction(formData);

      // Assert
      expect(result).toEqual({
        error: "Failed to delete post",
      });
    });

    it("should not revalidate cache on error", async () => {
      // Arrange
      const postId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
      const formData = makeFormData({ id: postId });

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ slug: "test-post", title: "Test Post" }]),
          })),
        })),
      }));

      (db as any).delete = vi.fn(() => {
        throw new Error("Database error");
      });

      // Act
      await deletePostAction(formData);

      // Assert
      expect(revalidateTagMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });
});

describe("deletePost.ts - canDeletePosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ user: { id: "admin-1", isAdmin: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true when user is admin", async () => {
    // Arrange
    requireAdminMock.mockResolvedValue({ user: { id: "admin-1", isAdmin: true } });

    // Act
    const result = await canDeletePosts();

    // Assert
    expect(result).toBe(true);
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
  });

  it("should return false when user is not admin", async () => {
    // Arrange
    requireAdminMock.mockRejectedValue(new Error("Forbidden"));

    // Act
    const result = await canDeletePosts();

    // Assert
    expect(result).toBe(false);
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
  });

  it("should return false on any error", async () => {
    // Arrange
    requireAdminMock.mockRejectedValue(new Error("Database error"));

    // Act
    const result = await canDeletePosts();

    // Assert
    expect(result).toBe(false);
  });
});
