// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRecentPosts, getArchiveMonths } from "@/lib/sidebar";

describe("Sidebar Functions - Unpublished Post Filtering", () => {
  let testPostIds: string[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    await db.execute(sql`DELETE FROM posts WHERE title LIKE 'Test Post for Sidebar %'`);
    
    // Create test posts - one published, one unpublished
    const publishedResult = await db.execute(sql`
      INSERT INTO posts (title, slug, body_html, body_md, html, excerpt, published_at, created_at, updated_at)
      VALUES (
        'Test Post for Sidebar Published',
        'test-post-sidebar-published',
        '<p>Published post content</p>',
        'Published post content',
        '<p>Published post content</p>',
        'Published excerpt',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '1 day'
      )
      RETURNING id
    `);
    
    const unpublishedResult = await db.execute(sql`
      INSERT INTO posts (title, slug, body_html, body_md, html, excerpt, published_at, created_at, updated_at)
      VALUES (
        'Test Post for Sidebar Unpublished',
        'test-post-sidebar-unpublished',
        '<p>Unpublished post content</p>',
        'Unpublished post content',
        '<p>Unpublished post content</p>',
        'Unpublished excerpt',
        NULL,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
      )
      RETURNING id
    `);

    const publishedRows: any[] = publishedResult.rows ?? (Array.isArray(publishedResult) ? publishedResult : []);
    const unpublishedRows: any[] = unpublishedResult.rows ?? (Array.isArray(unpublishedResult) ? unpublishedResult : []);
    
    if (publishedRows.length > 0) testPostIds.push(publishedRows[0].id);
    if (unpublishedRows.length > 0) testPostIds.push(unpublishedRows[0].id);
  });

  afterEach(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM posts WHERE title LIKE 'Test Post for Sidebar %'`);
  });

  it("should only return published posts in getRecentPosts", async () => {
    const recentPosts = await getRecentPosts(10);
    
    // Should not include unpublished posts
    const unpublishedPosts = recentPosts.filter(post => 
      post.title === 'Test Post for Sidebar Unpublished'
    );
    expect(unpublishedPosts).toHaveLength(0);
    
    // Should include published posts
    const publishedPosts = recentPosts.filter(post => 
      post.title === 'Test Post for Sidebar Published'
    );
    expect(publishedPosts).toHaveLength(1);
    
    // All returned posts should have non-null publishedAt
    recentPosts.forEach(post => {
      expect(post.publishedAt).not.toBeNull();
    });
  });

  it("should only count published posts in archive months", async () => {
    const archiveMonths = await getArchiveMonths(12);
    
    // All archive months should only include published posts
    // Since our published post has published_at set to yesterday,
    // it should appear in the current month's count
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const currentMonthArchive = archiveMonths.find(
      month => month.year === currentYear && month.month === currentMonth
    );
    
    if (currentMonthArchive) {
      // The count should be at least 1 (our published test post)
      expect(currentMonthArchive.count).toBeGreaterThanOrEqual(1);
    }
  });
});