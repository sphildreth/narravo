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

