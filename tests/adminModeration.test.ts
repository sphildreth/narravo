import { describe, it, expect, vi } from 'vitest';
import { moderateComments, type ModerationRepo } from '../lib/adminModeration';

function makeRepo(overrides: Partial<ModerationRepo> = {}): ModerationRepo {
  return {
    updateStatus: vi.fn(async (ids) => ids.length),
    hardDelete: vi.fn(async (ids) => ids.length),
    editComment: vi.fn(async () => true),
    removeAttachment: vi.fn(async () => true),
    ...overrides,
  };
}

describe('adminModeration.moderateComments', () => {
  it('approves comments in bulk', async () => {
    const repo = makeRepo();
    const res = await moderateComments(repo, { action: 'approve', ids: ['a','b','c'] });
    expect(res).toHaveLength(3);
    expect(res.every(r => r.ok)).toBe(true);
  });

  it('marks spam and delete', async () => {
    const repo = makeRepo();
    const spam = await moderateComments(repo, { action: 'spam', ids: ['x'] });
    expect(spam[0].ok).toBe(true);
    const del = await moderateComments(repo, { action: 'delete', ids: ['y','z'] });
    expect(del.map(r=>r.ok)).toEqual([true,true]);
  });

  it('hard deletes items', async () => {
    const repo = makeRepo();
    const res = await moderateComments(repo, { action: 'hardDelete', ids: ['1','2'] });
    expect(res).toHaveLength(2);
    expect(res.every(r => r.ok)).toBe(true);
  });

  it('edits a comment with sanitization', async () => {
    const editSpy = vi.fn(async () => true);
    const repo = makeRepo({ editComment: editSpy });
    const res = await moderateComments(repo, { action: 'edit', id: 'c1', bodyMd: '<img src=x onerror=alert(1)>' });
    expect(res[0].ok).toBe(true);
    expect(editSpy).toHaveBeenCalled();
    const [_id, bodyMd, bodyHtml] = editSpy.mock.calls[0];
    expect(bodyMd).toContain('<img');
    expect(String(bodyHtml)).not.toContain('onerror');
  });

  it('removes attachment', async () => {
    const repo = makeRepo();
    const res = await moderateComments(repo, { action: 'removeAttachment', attachmentId: 'att-1' });
    expect(res[0].ok).toBe(true);
  });
});
