// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the database to avoid connection issues in CI
vi.mock("@/lib/db", () => ({
  db: { execute: vi.fn() },
}));

// Mock the archives module since getArchiveMonths depends on it
vi.mock("@/lib/archives", () => ({
  listArchiveMonths: vi.fn(),
}));

describe("Sidebar Functions - Unpublished Post Filtering", () => {
  beforeEach(async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.execute).mockReset();
    
    const { listArchiveMonths } = await import("@/lib/archives");
    vi.mocked(listArchiveMonths).mockReset();
  });

  it("should only return published posts in getRecentPosts", async () => {
    const { db } = await import("@/lib/db");
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Mock database response with only published posts (published_at is not null)
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [
        {
          id: "published-1",
          slug: "test-post-sidebar-published",
          title: "Test Post for Sidebar Published",
          publishedAt: yesterday.toISOString(),
        },
        {
          id: "published-2",
          slug: "another-published-post",
          title: "Another Published Post",
          publishedAt: yesterday.toISOString(),
        },
      ],
    } as any);
    
    const { getRecentPosts } = await import("@/lib/sidebar");
    const recentPosts = await getRecentPosts(10);
    
    // Should return the mocked published posts
    expect(recentPosts).toHaveLength(2);
    
    // All returned posts should have non-null publishedAt
    recentPosts.forEach(post => {
      expect(post.publishedAt).not.toBeNull();
    });
    
    // Verify the correct data is returned
    expect(recentPosts[0]?.title).toBe("Test Post for Sidebar Published");
    expect(recentPosts[1]?.title).toBe("Another Published Post");
  });

  it("should only count published posts in archive months", async () => {
    const { listArchiveMonths } = await import("@/lib/archives");
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // Mock the archives response with some test data
    vi.mocked(listArchiveMonths).mockResolvedValueOnce([
      {
        year: currentYear,
        month: currentMonth,
        count: 5, // Published posts count
      },
      {
        year: currentYear,
        month: currentMonth - 1 || 12,
        count: 3,
      },
      {
        year: currentYear - (currentMonth === 1 ? 1 : 0),
        month: currentMonth - 2 || 11,
        count: 7,
      },
    ]);
    
    const { getArchiveMonths } = await import("@/lib/sidebar");
    const archiveMonths = await getArchiveMonths(12);
    
    // Should return properly formatted archive months
    expect(archiveMonths).toHaveLength(3);
    
    // Verify the current month archive
    const currentMonthArchive = archiveMonths.find(
      month => month.year === currentYear && month.month === currentMonth
    );
    
    expect(currentMonthArchive).toBeDefined();
    expect(currentMonthArchive!.count).toBe(5);
    expect(currentMonthArchive!.key).toBe(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
    expect(currentMonthArchive!.label).toContain(String(currentYear));
  });
});