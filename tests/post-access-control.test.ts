// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the database to avoid connection issues in CI
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

// Mock the schema
vi.mock("@/drizzle/schema", () => ({
  posts: {},
  reactions: {},
}));

describe("Post Access Control - Unpublished Post Protection", () => {
  beforeEach(async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.select).mockReset();
    vi.mocked(db.execute).mockReset();
  });

  it("should NOT return unpublished post to non-admin user", async () => {
    const { db } = await import("@/lib/db");
    
    // Mock db.execute to return empty rows (no unpublished posts for non-admin)
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as any);
    
    const { getPostBySlug } = await import("@/lib/posts");
    const post = await getPostBySlug("test-unpublished-access-control", false);
    expect(post).toBeNull();
  });

  it("should return unpublished post to admin user", async () => {
    const { db } = await import("@/lib/db");
    const now = new Date();
    
    // Mock db.execute to return unpublished post for admin
    const mockPost = {
      id: "test-id-1",
      title: "Test Unpublished Post Access Control",
      slug: "test-unpublished-access-control",
      excerpt: "Test excerpt",
      bodyHtml: "<p>This is an unpublished post</p>",
      bodyMd: "This is an unpublished post",
      html: "<p>This is an unpublished post</p>",
      publishedAt: null, // Unpublished
      categoryId: null,
      featuredImageUrl: null,
      featuredImageAlt: null,
      isLocked: false,
    };
    
    // Mock both the main query and the tag/category queries with proper date format
    vi.mocked(db.execute)
      .mockResolvedValueOnce({ rows: [mockPost] } as any) // Main post query
      .mockResolvedValueOnce({ rows: [] } as any); // Tags query (empty)
    
    const { getPostBySlug } = await import("@/lib/posts");
    const post = await getPostBySlug("test-unpublished-access-control", true);
    expect(post).not.toBeNull();
    expect(post?.title).toBe("Test Unpublished Post Access Control");
    expect(post?.publishedAt).toBeNull();
  });

  it("should NOT return unpublished post with reactions to non-admin user", async () => {
    const { db } = await import("@/lib/db");
    
    // Mock db.execute to return empty rows for non-admin user
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as any);
    
    const { getPostBySlugWithReactions } = await import("@/lib/posts");
    const post = await getPostBySlugWithReactions("test-unpublished-access-control", undefined, false);
    expect(post).toBeNull();
  });

  it("should return unpublished post with reactions to admin user", async () => {
    const { db } = await import("@/lib/db");
    const now = new Date();
    
    // Mock the database queries for post with reactions
    const mockPost = {
      id: "test-id-1",
      title: "Test Unpublished Post Access Control",
      slug: "test-unpublished-access-control",
      excerpt: "Test excerpt",
      bodyHtml: "<p>This is an unpublished post</p>",
      bodyMd: "This is an unpublished post",
      html: "<p>This is an unpublished post</p>",
      publishedAt: null,
      categoryId: null,
      featuredImageUrl: null,
      featuredImageAlt: null,
      isLocked: false,
    };
    
    // Mock sequential database calls:
    // 1. Main post query
    // 2. Tags query 
    // 3. Reaction counts query
    // 4. User reactions query (if userId provided)
    vi.mocked(db.execute)
      .mockResolvedValueOnce({ rows: [mockPost] } as any) // Main post query
      .mockResolvedValueOnce({ rows: [] } as any) // Tags query
      .mockResolvedValueOnce({ rows: [] } as any) // Reaction counts query  
      .mockResolvedValueOnce({ rows: [] } as any); // User reactions query
    
    const { getPostBySlugWithReactions } = await import("@/lib/posts");
    const post = await getPostBySlugWithReactions("test-unpublished-access-control", undefined, true);
    expect(post).not.toBeNull();
    expect(post?.title).toBe("Test Unpublished Post Access Control");
    expect(post?.publishedAt).toBeNull();
    expect(post?.reactions).toBeDefined();
  });

  it("should still return published posts to non-admin users", async () => {
    const { db } = await import("@/lib/db");
    const now = new Date();
    
    // Mock db.execute to return published post for non-admin
    const mockPost = {
      id: "test-id-2",
      title: "Test Published Post Access Control",
      slug: "test-published-access-control",
      excerpt: "Published excerpt",
      bodyHtml: "<p>This is a published post</p>",
      bodyMd: "This is a published post",
      html: "<p>This is a published post</p>",
      publishedAt: now.toISOString(), // Published
      categoryId: null,
      featuredImageUrl: null,
      featuredImageAlt: null,
      isLocked: false,
    };
    
    // Mock both the main query and the tag/category queries
    vi.mocked(db.execute)
      .mockResolvedValueOnce({ rows: [mockPost] } as any) // Main post query
      .mockResolvedValueOnce({ rows: [] } as any); // Tags query (empty)
    
    const { getPostBySlug } = await import("@/lib/posts");
    const post = await getPostBySlug("test-published-access-control", false);
    expect(post).not.toBeNull();
    expect(post?.title).toBe("Test Published Post Access Control");
    expect(post?.publishedAt).not.toBeNull();
  });
});