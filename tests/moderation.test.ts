import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModerationQueue, revalidateAfterModeration, type ModerationFilter } from '@/lib/moderation';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

describe('moderation queue functionality', () => {
  it('should fetch moderation queue with basic filter', async () => {
    const { db } = await import('@/lib/db');
    
    // Mock count query result
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ total: 5 }] });
    
    // Mock data query result
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [
        {
          id: 'comment-1',
          postId: 'post-1',
          userId: 'user-1',
          bodyHtml: '<p>Test comment</p>',
          bodyMd: 'Test comment',
          status: 'pending',
          createdAt: new Date().toISOString(),
          authorName: 'John Doe',
          authorEmail: 'john@example.com',
          authorImage: 'https://example.com/avatar.jpg',
          postSlug: 'test-post',
          postTitle: 'Test Post',
        },
      ]
    });

    // Mock attachments query (empty)
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] });

    const filter: ModerationFilter = { status: 'pending' };
    const result = await getModerationQueue(filter, 1, 20);

    expect(result.totalCount).toBe(5);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].status).toBe('pending');
    expect(result.comments[0].author.name).toBe('John Doe');
  });

  it('should handle pagination correctly', async () => {
    const { db } = await import('@/lib/db');
    
    // Mock count query result - enough for multiple pages
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ total: 45 }] });
    
    // Mock data query result for page 2
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [
        {
          id: 'comment-21',
          postId: 'post-21',
          userId: 'user-21',
          bodyHtml: '<p>Page 2 comment</p>',
          bodyMd: 'Page 2 comment',
          status: 'pending',
          createdAt: new Date().toISOString(),
          authorName: 'User 21',
          authorEmail: 'user21@example.com',
          authorImage: null,
          postSlug: 'page-2-post',
          postTitle: 'Page 2 Post',
        },
      ]
    });

    // Mock attachments query (empty)
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] });

    const result = await getModerationQueue({}, 2, 20);

    expect(result.totalCount).toBe(45);
    expect(result.hasMore).toBe(true); // 45 total, page 2 (offset 20), so 20 + 20 = 40 < 45 = true
    expect(result.comments).toHaveLength(1);
  });

  it('should call revalidation for affected posts', async () => {
    const { revalidateTag } = await import('next/cache');
    
    await revalidateAfterModeration(['post-1', 'post-2']);

    expect(revalidateTag).toHaveBeenCalledWith('post:post-1');
    expect(revalidateTag).toHaveBeenCalledWith('post:post-2');
    expect(revalidateTag).toHaveBeenCalledWith('home');
  });
});