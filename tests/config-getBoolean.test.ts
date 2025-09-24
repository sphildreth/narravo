// filepath: /home/steven/source/narravo/tests/config-getBoolean.test.ts
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db to avoid real connections during import of lib/config
vi.mock('@/lib/db', () => ({ db: {} }));

import { ConfigServiceImpl, type Repo } from '@/lib/config';

class FakeRepo implements Repo {
  private store = new Map<string, any>();
  async readEffective(key: string): Promise<any | null> {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  async upsertGlobal(): Promise<void> { throw new Error('not implemented'); }
  async getGlobalType(): Promise<any> { return null; }
  async getGlobalMeta(): Promise<any> { return null; }
  async upsertUser(): Promise<void> { throw new Error('not implemented'); }
  async deleteUser(): Promise<void> { throw new Error('not implemented'); }
  async getGlobalNumber(key: string): Promise<number | null> {
    // Only TTL key may be requested; return null to keep defaults
    return null;
  }
  async deleteGlobal(): Promise<void> { throw new Error('not implemented'); }

  set(key: string, value: any) { this.store.set(key, value); }
}

describe('ConfigServiceImpl.getBoolean coercion', () => {
  let repo: FakeRepo;
  let cfg: ConfigServiceImpl;

  beforeEach(() => {
    repo = new FakeRepo();
    cfg = new ConfigServiceImpl({ repo });
  });

  it('returns boolean when value is boolean', async () => {
    repo.set('VIEW.PUBLIC-SHOW-RENDER-BADGE', true);
    await expect(cfg.getBoolean('VIEW.PUBLIC-SHOW-RENDER-BADGE')).resolves.toBe(true);
  });

  it('coerces string "true"/"false" to boolean', async () => {
    repo.set('X.FLAG', 'true');
    repo.set('Y.FLAG', 'false');
    await expect(cfg.getBoolean('X.FLAG')).resolves.toBe(true);
    await expect(cfg.getBoolean('Y.FLAG')).resolves.toBe(false);
  });

  it('coerces number 1/0 to boolean', async () => {
    repo.set('A.FLAG', 1);
    repo.set('B.FLAG', 0);
    await expect(cfg.getBoolean('A.FLAG')).resolves.toBe(true);
    await expect(cfg.getBoolean('B.FLAG')).resolves.toBe(false);
  });

  it('returns null for unsupported shapes', async () => {
    repo.set('OBJ.FLAG', { on: true });
    await expect(cfg.getBoolean('OBJ.FLAG')).resolves.toBeNull();
  });
});

