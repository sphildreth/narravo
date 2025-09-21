// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from 'vitest';

// Mock db to avoid real connections during import of lib/config
vi.mock('../lib/db', () => ({ db: {} }));

const { __testables__ } = await import('../lib/config');
const { normalizeKey, ensureType, inAllowed, minutesToMs, withJitter } = __testables__;

describe('config helpers', () => {
  it('normalizeKey enforces uppercase dot-separated segments with dashes', () => {
    expect(normalizeKey('system.cache.default-ttl')).toBe('SYSTEM.CACHE.DEFAULT-TTL');
    expect(() => normalizeKey('lowercase and spaces')).toThrow();
    expect(() => normalizeKey('INVALID__UNDERSCORE')).toThrow();
    expect(() => normalizeKey('SYSTEM..DOUBLE')).toThrow();
  });

  it('ensureType validates basic types', () => {
    expect(ensureType('x', 'string')).toBe(true);
    expect(ensureType(5, 'integer')).toBe(true);
    expect(ensureType(5.5, 'integer')).toBe(false);
    expect(ensureType(5.5, 'number')).toBe(true);
    expect(ensureType(true, 'boolean')).toBe(true);
    expect(ensureType('2024-01-01T00:00:00Z', 'datetime')).toBe(true);
    expect(ensureType({ a: 1 }, 'json')).toBe(true);
  });

  it('inAllowed matches by deep-equal semantics', () => {
    expect(inAllowed('dark', ['light', 'dark'])).toBe(true);
    expect(inAllowed('blue', ['light', 'dark'])).toBe(false);
    expect(inAllowed({ a: 1 }, [{ a: 1 }])).toBe(true);
  });

  it('minutesToMs clamps to at least 60s', () => {
    expect(minutesToMs(0)).toBe(60_000);
    expect(minutesToMs(1)).toBe(60_000);
    expect(minutesToMs(1.5)).toBe(90_000);
  });

  it('withJitter stays roughly around the base and positive', () => {
    const base = 60_000;
    const v = withJitter(base, 0.1);
    expect(v).toBeGreaterThan(0);
    // Allow a wide range check due to randomness
    expect(v).toBeGreaterThanOrEqual(base * 0.8);
    expect(v).toBeLessThanOrEqual(base * 1.2);
  });
});

describe('ConfigService user allowlist', () => {
  it('allows user overrides when no allowlist is configured', async () => {
    const { ConfigServiceImpl } = await import('../lib/config');
    const mockRepo = {
      readEffective: vi.fn(),
      upsertGlobal: vi.fn(),
      getGlobalType: vi.fn().mockResolvedValue('string'),
      upsertUser: vi.fn(),
      deleteUser: vi.fn(),
      getGlobalNumber: vi.fn()
    };
    
    const service = new ConfigServiceImpl({ repo: mockRepo });
    
    // Should allow any key when no allowlist is set
    expect(service.canUserOverride('THEME')).toBe(true);
    expect(service.canUserOverride('ANY.KEY')).toBe(true);
  });

  it('restricts user overrides to allowlisted keys only', async () => {
    const { ConfigServiceImpl } = await import('../lib/config');
    const mockRepo = {
      readEffective: vi.fn(),
      upsertGlobal: vi.fn(),
      getGlobalType: vi.fn().mockResolvedValue('string'),
      upsertUser: vi.fn(),
      deleteUser: vi.fn(),
      getGlobalNumber: vi.fn()
    };
    
    const allowUserOverrides = new Set(['THEME', 'USER.LANGUAGE']);
    const service = new ConfigServiceImpl({ repo: mockRepo, allowUserOverrides });
    
    // Should allow allowlisted keys
    expect(service.canUserOverride('THEME')).toBe(true);
    expect(service.canUserOverride('USER.LANGUAGE')).toBe(true);
    
    // Should reject non-allowlisted keys
    expect(service.canUserOverride('SYSTEM.CACHE.DEFAULT-TTL')).toBe(false);
    expect(service.canUserOverride('OTHER.KEY')).toBe(false);
  });

  it('throws error when setting user override for non-allowlisted key', async () => {
    const { ConfigServiceImpl } = await import('../lib/config');
    const mockRepo = {
      readEffective: vi.fn(),
      upsertGlobal: vi.fn(),
      getGlobalType: vi.fn().mockResolvedValue('string'),
      upsertUser: vi.fn(),
      deleteUser: vi.fn(),
      getGlobalNumber: vi.fn()
    };
    
    const allowUserOverrides = new Set(['THEME']);
    const service = new ConfigServiceImpl({ repo: mockRepo, allowUserOverrides });
    
    // Should throw for non-allowlisted key
    await expect(service.setUserOverride('SYSTEM.CACHE.DEFAULT-TTL', 'user123', 60))
      .rejects.toThrow('User overrides not allowed for key: SYSTEM.CACHE.DEFAULT-TTL');
      
    // Should work for allowlisted key
    await expect(service.setUserOverride('THEME', 'user123', 'dark'))
      .resolves.not.toThrow();
  });

  it('throws error when deleting user override for non-allowlisted key', async () => {
    const { ConfigServiceImpl } = await import('../lib/config');
    const mockRepo = {
      readEffective: vi.fn(),
      upsertGlobal: vi.fn(),
      getGlobalType: vi.fn(),
      upsertUser: vi.fn(),
      deleteUser: vi.fn(),
      getGlobalNumber: vi.fn()
    };
    
    const allowUserOverrides = new Set(['THEME']);
    const service = new ConfigServiceImpl({ repo: mockRepo, allowUserOverrides });
    
    // Should throw for non-allowlisted key
    await expect(service.deleteUserOverride('SYSTEM.CACHE.DEFAULT-TTL', 'user123'))
      .rejects.toThrow('User overrides not allowed for key: SYSTEM.CACHE.DEFAULT-TTL');
      
    // Should work for allowlisted key
    await expect(service.deleteUserOverride('THEME', 'user123'))
      .resolves.not.toThrow();
  });
});

