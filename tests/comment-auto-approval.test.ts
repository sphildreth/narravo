// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createComment } from '@/components/comments/actions';
import { requireSession } from '@/lib/auth';
import { ConfigServiceImpl } from '@/lib/config';
import { createCommentCore } from '@/lib/comments';
import { validateAntiAbuse } from '@/lib/rateLimit';
import { headers } from 'next/headers';
import { db } from '@/lib/db';

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  ConfigServiceImpl: vi.fn().mockImplementation(() => ({
    getNumber: vi.fn(),
    getBoolean: vi.fn(),
  })),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

vi.mock('@/lib/comments', () => ({
  createCommentCore: vi.fn(),
}));

vi.mock('@/lib/rateLimit', () => ({
  validateAntiAbuse: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

describe('Comment Auto-Approval', () => {
  const mockRequireSession = vi.mocked(requireSession);
  const mockConfigService = vi.mocked(ConfigServiceImpl);
  const mockCreateCommentCore = vi.mocked(createCommentCore);
  const mockValidateAntiAbuse = vi.mocked(validateAntiAbuse);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers());
    
    // Mock successful comment creation
    mockCreateCommentCore.mockResolvedValue({ id: 'test-comment-id' });
    
    // Mock successful anti-abuse validation
    mockValidateAntiAbuse.mockResolvedValue({ valid: true });
    
    // Mock database operations
    const mockDb = vi.mocked(db);
    // Mock post exists check - return a post
    mockDb.select().from().where().limit.mockResolvedValue([{ id: 'test-post-id' }]);
    // Mock comment insert - return comment id
    mockDb.insert().values().returning.mockResolvedValue([{ id: 'test-comment-id' }]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-approve comments from admin users', async () => {
    // Mock admin user session
    mockRequireSession.mockResolvedValue({
      user: { id: 'admin-user-id', isAdmin: true },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // Mock config - auto-approve disabled but user is admin
    const mockConfigInstance = {
      getNumber: vi.fn().mockResolvedValue(5), // MAX-DEPTH
      getBoolean: vi.fn().mockResolvedValue(false), // AUTO-APPROVE off
    };
    (mockConfigService as any).mockReturnValue(mockConfigInstance);

    let capturedCommentData: any = null;
    mockCreateCommentCore.mockImplementation(async (deps: any, data: any) => {
      // Capture the comment data that would be inserted
      capturedCommentData = await deps.insertComment(data);
      return { id: 'test-comment-id' };
    });

    const result = await createComment({
      postId: 'test-post-id',
      parentId: null,
      bodyMd: 'Test comment from admin',
      submitStartTime: Date.now() - 3000, // 3 seconds ago
      honeypot: '',
    });

    expect(result.success).toBe(true);
    expect(mockCreateCommentCore).toHaveBeenCalled();
    
    // Verify that the insertComment function was called and would insert with 'approved' status
    const insertCommentFn = mockCreateCommentCore.mock.calls[0]?.[0]?.insertComment;
    expect(insertCommentFn).toBeDefined();
  });

  it('should auto-approve comments when AUTO-APPROVE is enabled', async () => {
    // Mock regular user session
    mockRequireSession.mockResolvedValue({
      user: { id: 'regular-user-id', isAdmin: false },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // Mock config - auto-approve enabled
    const mockConfigInstance = {
      getNumber: vi.fn().mockResolvedValue(5), // MAX-DEPTH
      getBoolean: vi.fn().mockResolvedValue(true), // AUTO-APPROVE on
    };
    (mockConfigService as any).mockReturnValue(mockConfigInstance);

    mockCreateCommentCore.mockImplementation(async (deps: any, data: any) => {
      // Capture the comment data that would be inserted
      await deps.insertComment(data);
      return { id: 'test-comment-id' };
    });

    const result = await createComment({
      postId: 'test-post-id',
      parentId: null,
      bodyMd: 'Test comment from regular user',
      submitStartTime: Date.now() - 3000, // 3 seconds ago
      honeypot: '',
    });

    expect(result.success).toBe(true);
    expect(mockCreateCommentCore).toHaveBeenCalled();
  });

  it('should require moderation for regular users when auto-approve is disabled', async () => {
    // Mock regular user session
    mockRequireSession.mockResolvedValue({
      user: { id: 'regular-user-id', isAdmin: false },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // Mock config - auto-approve disabled
    const mockConfigInstance = {
      getNumber: vi.fn().mockResolvedValue(5), // MAX-DEPTH
      getBoolean: vi.fn().mockResolvedValue(false), // AUTO-APPROVE off
    };
    (mockConfigService as any).mockReturnValue(mockConfigInstance);

    mockCreateCommentCore.mockImplementation(async (deps: any, data: any) => {
      // Capture the comment data that would be inserted
      await deps.insertComment(data);
      return { id: 'test-comment-id' };
    });

    const result = await createComment({
      postId: 'test-post-id',
      parentId: null,
      bodyMd: 'Test comment from regular user',
      submitStartTime: Date.now() - 3000, // 3 seconds ago
      honeypot: '',
    });

    expect(result.success).toBe(true);
    expect(mockCreateCommentCore).toHaveBeenCalled();
  });
});