// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module before importing the module under test
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/drizzle/schema', () => ({
  redirects: {
    toPath: 'toPath',
    status: 'status',
    fromPath: 'fromPath',
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
}));

// Import after mocks are set up
import { findRedirect, createRedirect, getAllRedirects } from '@/lib/redirects';
import { db } from '@/lib/db';

describe('Redirects utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe('findRedirect', () => {
    it('should find an existing redirect', async () => {
      const mockRedirectResult = [
        { toPath: '/new-path', status: 301 }
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRedirectResult),
          }),
        }),
      });

      const result = await findRedirect('/old-path');

      expect(result).toEqual({ toPath: '/new-path', status: 301 });
    });

    it('should return null if no redirect found', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await findRedirect('/non-existent-path');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await findRedirect('/error-path');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error finding redirect:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('createRedirect', () => {
    it('should create a new redirect with default status', async () => {
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      (db.insert as any).mockReturnValue(mockInsert);

      await createRedirect('/old-path', '/new-path');

      expect(db.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith({
        fromPath: '/old-path',
        toPath: '/new-path',
        status: 301,
      });
    });

    it('should create a new redirect with custom status', async () => {
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      (db.insert as any).mockReturnValue(mockInsert);

      await createRedirect('/old-path', '/new-path', 302);

      expect(mockInsert.values).toHaveBeenCalledWith({
        fromPath: '/old-path',
        toPath: '/new-path',
        status: 302,
      });
    });
  });

  describe('getAllRedirects', () => {
    it('should return all redirects', async () => {
      const mockRedirectResults = [
        { fromPath: '/old-1', toPath: '/new-1', status: 301 },
        { fromPath: '/old-2', toPath: '/new-2', status: 302 },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockRedirectResults),
      });

      const result = await getAllRedirects();

      expect(result).toEqual(mockRedirectResults);
    });

    it('should handle database errors gracefully', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getAllRedirects();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting all redirects:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});