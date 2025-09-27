// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getPostBySlug, getPostBySlugWithReactions } from "@/lib/posts";

describe("Post Access Control - Unpublished Post Protection", () => {
  let testPostId: string | null = null;

  beforeEach(async () => {
    // Clean up any existing test data
    await db.execute(sql`DELETE FROM posts WHERE title = 'Test Unpublished Post Access Control'`);
    
    // Create a test unpublished post
    const result = await db.execute(sql`
      INSERT INTO posts (title, slug, body_html, body_md, excerpt, published_at, created_at, updated_at)
      VALUES (
        'Test Unpublished Post Access Control',
        'test-unpublished-access-control',
        '<p>This is an unpublished post</p>',
        'This is an unpublished post',
        'Test excerpt',
        NULL,
        NOW(),
        NOW()
      )
      RETURNING id
    `);

    const rows: any[] = result.rows ?? (Array.isArray(result) ? result : []);
    if (rows.length > 0) {
      testPostId = rows[0].id;
    }
  });

  afterEach(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM posts WHERE title = 'Test Unpublished Post Access Control'`);
    testPostId = null;
  });

  it("should NOT return unpublished post to non-admin user", async () => {
    const post = await getPostBySlug("test-unpublished-access-control", false);
    expect(post).toBeNull();
  });

  it("should return unpublished post to admin user", async () => {
    const post = await getPostBySlug("test-unpublished-access-control", true);
    expect(post).not.toBeNull();
    expect(post?.title).toBe("Test Unpublished Post Access Control");
    expect(post?.publishedAt).toBeNull();
  });

  it("should NOT return unpublished post with reactions to non-admin user", async () => {
    const post = await getPostBySlugWithReactions("test-unpublished-access-control", undefined, false);
    expect(post).toBeNull();
  });

  it("should return unpublished post with reactions to admin user", async () => {
    const post = await getPostBySlugWithReactions("test-unpublished-access-control", undefined, true);
    expect(post).not.toBeNull();
    expect(post?.title).toBe("Test Unpublished Post Access Control");
    expect(post?.publishedAt).toBeNull();
    expect(post?.reactions).toBeDefined();
  });

  it("should still return published posts to non-admin users", async () => {
    // Create a published post for comparison
    await db.execute(sql`
      INSERT INTO posts (title, slug, body_html, body_md, excerpt, published_at, created_at, updated_at)
      VALUES (
        'Test Published Post Access Control',
        'test-published-access-control',
        '<p>This is a published post</p>',
        'This is a published post',
        'Published excerpt',
        NOW(),
        NOW(),
        NOW()
      )
    `);

    const post = await getPostBySlug("test-published-access-control", false);
    expect(post).not.toBeNull();
    expect(post?.title).toBe("Test Published Post Access Control");
    expect(post?.publishedAt).not.toBeNull();

    // Clean up
    await db.execute(sql`DELETE FROM posts WHERE title = 'Test Published Post Access Control'`);
  });
});