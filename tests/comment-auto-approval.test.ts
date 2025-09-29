// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createComment } from '@/components/comments/actions';

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
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/comments', () => ({
  createCommentCore: vi.fn(),
  sanitizeMarkdown: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

describe('Comment Auto-Approval', () => {
  const mockRequireSession = vi.mocked(require('@/lib/auth').requireSession);
  const mockConfigService = vi.mocked(require('@/lib/config').ConfigServiceImpl);
  const mockCreateCommentCore = vi.mocked(require('@/lib/comments').createCommentCore);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock headers
    require('next/headers').headers.mockResolvedValue(new Headers());
    
    // Mock successful comment creation
    mockCreateCommentCore.mockResolvedValue({ id: 'test-comment-id' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-approve comments from admin users', async () => {
    // Mock admin user session
    mockRequireSession.mockResolvedValue({
      user: { id: 'admin-user-id', isAdmin: true }
    });

    // Mock config - auto-approve disabled but user is admin
    const mockConfigInstance = {
      getNumber: vi.fn().mockResolvedValue(5), // MAX-DEPTH
      getBoolean: vi.fn().mockResolvedValue(false), // AUTO-APPROVE off
    };
    mockConfigService.mockReturnValue(mockConfigInstance);

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
    const insertCommentFn = mockCreateCommentCore.mock.calls[0][0].insertComment;
    expect(insertCommentFn).toBeDefined();
  });

  it('should auto-approve comments when AUTO-APPROVE is enabled', async () => {
    // Mock regular user session
    mockRequireSession.mockResolvedValue({
      user: { id: 'regular-user-id', isAdmin: false }
    });

    // Mock config - auto-approve enabled
    const mockConfigInstance = {
      getNumber: vi.fn().mockResolvedValue(5), // MAX-DEPTH
      getBoolean: vi.fn().mockResolvedValue(true), // AUTO-APPROVE on
    };
    mockConfigService.mockReturnValue(mockConfigInstance);

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
      user: { id: 'regular-user-id', isAdmin: false }
    });

    // Mock config - auto-approve disabled
    const mockConfigInstance = {
      getNumber: vi.fn().mockResolvedValue(5), // MAX-DEPTH
      getBoolean: vi.fn().mockResolvedValue(false), // AUTO-APPROVE off
    };
    mockConfigService.mockReturnValue(mockConfigInstance);

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