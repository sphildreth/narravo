// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { anonymizeUser, type UsersRepo } from '@/lib/adminUsers';

class MockRepo implements UsersRepo {
  deletedById: string[] = [];
  deletedByEmail: string[] = [];
  async deleteById(id: string): Promise<number> { this.deletedById.push(id); return 1; }
  async deleteByEmail(email: string): Promise<number> { this.deletedByEmail.push(email); return 1; }
}

describe('adminUsers.anonymizeUser', () => {
  it('deletes by id', async () => {
    const repo = new MockRepo();
    const res = await anonymizeUser(repo, { userId: 'u-1' });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('id');
    expect(repo.deletedById).toEqual(['u-1']);
  });
  it('deletes by email', async () => {
    const repo = new MockRepo();
    const res = await anonymizeUser(repo, { email: 'foo@example.com' });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('email');
    expect(repo.deletedByEmail).toEqual(['foo@example.com']);
  });
  it('requires exactly one identifier', async () => {
    const repo = new MockRepo();
    await expect(() => anonymizeUser(repo, {} as any)).rejects.toThrow();
    await expect(() => anonymizeUser(repo, { userId: 'a', email: 'b' })).rejects.toThrow();
  });
});
