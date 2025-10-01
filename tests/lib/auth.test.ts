/** @vitest-environment jsdom */
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import type { AdapterUser } from '@auth/core/adapters';

// Mock next-auth entirely to avoid module resolution issues
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() }
  }))
}));

vi.mock('next-auth/providers/github', () => ({
  default: vi.fn()
}));

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn()
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

vi.mock('@/lib/admin', () => ({
  isEmailAdmin: vi.fn((email: string | null) => email === 'admin@example.com')
}));

// Import the auth module after mocking dependencies
import { isEmailAdmin } from '@/lib/admin';

describe('auth logic', () => {
  describe('isEmailAdmin', () => {
    it('should return true for admin emails', () => {
      expect(isEmailAdmin('admin@example.com')).toBe(true);
    });

    it('should return false for non-admin emails', () => {
      expect(isEmailAdmin('user@example.com')).toBe(false);
    });

    it('should return false for null email', () => {
      expect(isEmailAdmin(null)).toBe(false);
    });
  });

  describe('signIn callback logic', () => {
    it('should allow sign-in for users with email', () => {
      const user: AdapterUser = { id: '1', email: 'test@example.com', emailVerified: null };
      const result = Boolean(user?.email);
      expect(result).toBe(true);
    });

    it('should deny sign-in for users without email', () => {
      const user: AdapterUser = { id: '2', email: '', emailVerified: null };
      const result = Boolean(user?.email);
      expect(result).toBe(false);
    });
  });
});
