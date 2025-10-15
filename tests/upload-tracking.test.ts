// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../src/lib/db';
import { uploads, posts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Upload Tracking System', () => {
  const testSessionId = 'test-session-123';
  const testPostId = '00000000-0000-0000-0000-000000000001';
  
  // Clean up test data
  afterEach(async () => {
    await db.delete(uploads).where(eq(uploads.sessionId, testSessionId));
  });

  describe('Temporary Upload Creation', () => {
    it('should create a temporary upload with correct defaults', async () => {
      const upload = await db.insert(uploads).values({
        key: 'images/test-123.jpg',
        url: '/uploads/images/test-123.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        sessionId: testSessionId,
      }).returning();

      expect(upload).toHaveLength(1);
      expect(upload[0]?.status).toBe('temporary');
      expect(upload[0]?.key).toBe('images/test-123.jpg');
      expect(upload[0]?.committedAt).toBeNull();
    });

    it('should track upload with user ID when provided', async () => {
      const userId = '00000000-0000-0000-0000-000000000002';
      const upload = await db.insert(uploads).values({
        key: 'images/test-124.jpg',
        url: '/uploads/images/test-124.jpg',
        mimeType: 'image/jpeg',
        size: 54321,
        sessionId: testSessionId,
        userId: userId,
      }).returning();

      expect(upload[0]?.userId).toBe(userId);
    });
  });

  describe('Upload Commitment', () => {
    it('should commit temporary upload to a post', async () => {
      // Create temporary upload
      const [tempUpload] = await db.insert(uploads).values({
        key: 'images/test-125.jpg',
        url: '/uploads/images/test-125.jpg',
        mimeType: 'image/jpeg',
        size: 67890,
        sessionId: testSessionId,
      }).returning();

      expect(tempUpload?.status).toBe('temporary');

      // Commit the upload
      const [committedUpload] = await db
        .update(uploads)
        .set({
          status: 'committed',
          postId: testPostId,
          committedAt: new Date(),
        })
        .where(eq(uploads.id, tempUpload!.id))
        .returning();

      expect(committedUpload?.status).toBe('committed');
      expect(committedUpload?.postId).toBe(testPostId);
      expect(committedUpload?.committedAt).not.toBeNull();
    });

    it('should handle multiple uploads for the same post', async () => {
      // Create multiple temporary uploads
      const uploadData = [
        { key: 'images/test-126.jpg', url: '/uploads/images/test-126.jpg' },
        { key: 'images/test-127.jpg', url: '/uploads/images/test-127.jpg' },
      ];

      const createdUploads = [];
      for (const data of uploadData) {
        const [upload] = await db.insert(uploads).values({
          ...data,
          mimeType: 'image/jpeg',
          size: 12345,
          sessionId: testSessionId,
        }).returning();
        createdUploads.push(upload);
      }

      // Commit all uploads to the same post
      const uploadIds = createdUploads.map(u => u!.id);
      for (const id of uploadIds) {
        await db
          .update(uploads)
          .set({
            status: 'committed',
            postId: testPostId,
            committedAt: new Date(),
          })
          .where(eq(uploads.id, id));
      }

      // Verify all are committed
      const committedUploads = await db
        .select()
        .from(uploads)
        .where(eq(uploads.postId, testPostId));

      expect(committedUploads).toHaveLength(2);
      expect(committedUploads.every(u => u.status === 'committed')).toBe(true);
    });
  });

  describe('Image URL Extraction', () => {
    it('should extract markdown image URLs', () => {
      const markdown = `
# Test Post

Some content here.

![Alt text](/uploads/images/test-128.jpg)

More content.

![Another image](/uploads/images/test-129.png)
      `;

      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const urls: string[] = [];
      let match;
      
      while ((match = imageRegex.exec(markdown)) !== null) {
        if (match[2]) urls.push(match[2]);
      }

      expect(urls).toEqual([
        '/uploads/images/test-128.jpg',
        '/uploads/images/test-129.png',
      ]);
    });

    it('should extract HTML img tag URLs', () => {
      const html = `
<p>Some content</p>
<img src="/uploads/images/test-130.jpg" alt="Test" />
<p>More content</p>
<img src="/uploads/images/test-131.png" alt="Another" />
      `;

      const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/g;
      const urls: string[] = [];
      let match;
      
      while ((match = htmlImageRegex.exec(html)) !== null) {
        if (match[1]) urls.push(match[1]);
      }

      expect(urls).toEqual([
        '/uploads/images/test-130.jpg',
        '/uploads/images/test-131.png',
      ]);
    });
  });

  describe('Upload Cleanup Logic', () => {
    it('should identify orphaned temporary uploads', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Create an old temporary upload
      await db.insert(uploads).values({
        key: 'images/test-132.jpg',
        url: '/uploads/images/test-132.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        sessionId: testSessionId,
        createdAt: oldDate,
      });

      // Create a recent temporary upload
      await db.insert(uploads).values({
        key: 'images/test-133.jpg',
        url: '/uploads/images/test-133.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        sessionId: testSessionId,
        createdAt: now,
      });

      // Query for uploads older than 24 hours
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oldUploads = await db
        .select()
        .from(uploads)
        .where(eq(uploads.sessionId, testSessionId));

      // At least one should be old enough
      const hasOldUpload = oldUploads.some(u => 
        u.createdAt && u.createdAt < cutoff
      );
      expect(hasOldUpload).toBe(true);
    });
  });

  describe('Schema Constraints', () => {
    it('should enforce unique key constraint', async () => {
      const uploadData = {
        key: 'images/test-134.jpg',
        url: '/uploads/images/test-134.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        sessionId: testSessionId,
      };

      // First insert should succeed
      await db.insert(uploads).values(uploadData);

      // Second insert with same key should fail
      await expect(
        db.insert(uploads).values(uploadData)
      ).rejects.toThrow();
    });

    it('should allow null postId for temporary uploads', async () => {
      const upload = await db.insert(uploads).values({
        key: 'images/test-135.jpg',
        url: '/uploads/images/test-135.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        sessionId: testSessionId,
        postId: undefined, // Explicitly null
      }).returning();

      expect(upload[0]?.postId).toBeNull();
    });
  });
});
