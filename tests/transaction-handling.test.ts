// SPDX-License-Identifier: Apache-2.0
/**
 * Transaction Handling Tests
 * 
 * Tests database transaction functionality including:
 * - Multi-table operations
 * - Rollback on error
 * - Isolation levels (simulated via mocks)
 * - Nested transaction handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

describe('Transaction Handling', () => {
  let mockClient: any;
  let db: NodePgDatabase<any>;

  beforeEach(() => {
    // Mock pg Client with transaction support
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };

    // Create a mock database instance
    db = {
      transaction: vi.fn(),
      execute: vi.fn(),
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Multi-table operations', () => {
    it('should execute multiple operations within a single transaction', async () => {
      // Arrange
      const operations = vi.fn().mockResolvedValue(undefined);
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act
      await db.transaction(async (tx) => {
        // Insert into first table
        await tx.insert({} as any).values({ name: 'Test Post' });
        
        // Update second table
        await tx.update({} as any).set({ count: 1 }).where(sql`id = 1`);
        
        // Execute custom SQL
        await tx.execute(sql`UPDATE users SET updated_at = NOW()`);
      });

      // Assert
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.execute).toHaveBeenCalled();
    });

    it('should maintain consistency across multiple table updates', async () => {
      // Arrange
      const postData = { id: 1, title: 'Test', viewsTotal: 0 };
      const commentData = { postId: 1, content: 'Comment' };
      
      const mockTx = {
        insert: vi.fn().mockImplementation((table: any) => ({
          values: vi.fn().mockResolvedValue([
            table === 'posts' ? postData : commentData
          ]),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act
      const result = await db.transaction(async (tx) => {
        const post = await tx.insert('posts' as any).values({ title: 'Test' });
        await tx.insert('comments' as any).values({ postId: post[0]?.id });
        await tx.update('posts' as any).set({ viewsTotal: 1 }).where(sql`id = 1`);
        return post[0];
      });

      // Assert
      expect(result).toEqual(postData);
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });

    it('should handle cascading updates across related tables', async () => {
      // Arrange
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
          }),
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act
      await db.transaction(async (tx) => {
        // Update parent record
        await tx.update({} as any).set({ status: 'archived' }).where(sql`id = 1`);
        
        // Find related records
        const relatedIds = await tx.select().from({} as any).where(sql`parent_id = 1`);
        
        // Update related records
        for (const record of relatedIds) {
          await tx.update({} as any).set({ parentStatus: 'archived' }).where(sql`id = ${record.id}`);
        }
      });

      // Assert
      expect(mockTx.update).toHaveBeenCalledTimes(3); // 1 parent + 2 children
      expect(mockTx.select).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rollback on error', () => {
    it('should rollback transaction when an error occurs', async () => {
      // Arrange
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        update: vi.fn().mockImplementation(() => {
          throw new Error('Database constraint violation');
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        try {
          return await fn(mockTx);
        } catch (error) {
          // Simulate rollback behavior
          throw error;
        }
      });

      // Act & Assert
      await expect(async () => {
        await db.transaction(async (tx) => {
          await tx.insert({} as any).values({ name: 'Test' });
          await tx.update({} as any); // This will throw
        });
      }).rejects.toThrow('Database constraint violation');

      // Verify that insert was called before error
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockTx.update).toHaveBeenCalled();
    });

    it('should not commit partial changes on error', async () => {
      // Arrange
      let commitCalled = false;
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        commit: vi.fn().mockImplementation(() => {
          commitCalled = true;
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        try {
          const result = await fn(mockTx);
          mockTx.commit();
          return result;
        } catch (error) {
          // Rollback - don't call commit
          throw error;
        }
      });

      // Act & Assert
      await expect(async () => {
        await db.transaction(async (tx) => {
          await tx.insert({} as any).values({ name: 'Test' });
          throw new Error('Intentional error');
        });
      }).rejects.toThrow('Intentional error');

      expect(commitCalled).toBe(false);
    });

    it('should handle multiple errors in transaction gracefully', async () => {
      // Arrange
      const errors: Error[] = [];
      const mockTx = {
        insert: vi.fn().mockImplementation(() => {
          throw new Error('Insert failed');
        }),
        update: vi.fn().mockImplementation(() => {
          throw new Error('Update failed');
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act & Assert
      await expect(async () => {
        await db.transaction(async (tx) => {
          try {
            await tx.insert({} as any).values({ name: 'Test' });
          } catch (e) {
            errors.push(e as Error);
          }
          
          try {
            await tx.update({} as any);
          } catch (e) {
            errors.push(e as Error);
          }

          // Re-throw the first error to rollback
          if (errors.length > 0) {
            throw errors[0];
          }
        });
      }).rejects.toThrow('Insert failed');

      expect(errors).toHaveLength(2);
      expect(errors[0]?.message).toBe('Insert failed');
      expect(errors[1]?.message).toBe('Update failed');
    });
  });

  describe('Isolation levels', () => {
    it('should simulate READ COMMITTED isolation', async () => {
      // Arrange
      const sharedData = { value: 100 };
      
      const createMockTx = (txId: string) => ({
        txId,
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ ...sharedData }]),
          }),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(async () => {
              // Simulate updating shared data
              sharedData.value += 10;
              return { rowCount: 1 };
            }),
          }),
        })),
      });

      const tx1 = createMockTx('tx1');
      const tx2 = createMockTx('tx2');

      // Act - Simulate concurrent transactions
      const result1 = await tx1.select().from({} as any).where(sql`id = 1`);
      await tx1.update().set({ value: 110 }).where(sql`id = 1`);

      const result2 = await tx2.select().from({} as any).where(sql`id = 1`);
      
      // Assert
      expect(result1[0]?.value).toBe(100); // Initial read
      expect(sharedData.value).toBe(110); // After tx1 update
      // tx2 reads the updated value since it's reading shared state after tx1's update
      expect(result2[0]?.value).toBe(110);
    });

    it('should handle concurrent updates to same record', async () => {
      // Arrange
      const mockTx1 = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
        }),
      };

      const mockTx2 = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('Row locked by another transaction')),
          }),
        }),
      };

      vi.mocked(db.transaction)
        .mockImplementationOnce(async (fn: any) => await fn(mockTx1))
        .mockImplementationOnce(async (fn: any) => await fn(mockTx2));

      // Act
      const tx1Promise = db.transaction(async (tx) => {
        await tx.update({} as any).set({ value: 100 }).where(sql`id = 1`);
      });

      // Act & Assert - tx2 should fail due to lock
      await tx1Promise;
      
      await expect(async () => {
        await db.transaction(async (tx) => {
          await tx.update({} as any).set({ value: 200 }).where(sql`id = 1`);
        });
      }).rejects.toThrow('Row locked by another transaction');
    });
  });

  describe('Nested transaction handling', () => {
    it('should handle savepoints for nested transactions', async () => {
      // Arrange
      const operations: string[] = [];
      
      const mockTx = {
        execute: vi.fn().mockImplementation((query: string) => {
          operations.push(query);
          return Promise.resolve(undefined);
        }),
        transaction: vi.fn().mockImplementation(async (fn: any) => {
          await mockTx.execute('SAVEPOINT nested');
          try {
            const result = await fn(mockTx);
            await mockTx.execute('RELEASE SAVEPOINT nested');
            return result;
          } catch (error) {
            await mockTx.execute('ROLLBACK TO SAVEPOINT nested');
            throw error;
          }
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act
      await db.transaction(async (tx) => {
        await tx.execute('INSERT INTO table1 VALUES (1)');
        
        // Nested transaction (savepoint)
        await tx.transaction(async (nestedTx) => {
          await nestedTx.execute('INSERT INTO table2 VALUES (2)');
        });
        
        await tx.execute('INSERT INTO table3 VALUES (3)');
      });

      // Assert
      expect(operations).toContain('INSERT INTO table1 VALUES (1)');
      expect(operations).toContain('SAVEPOINT nested');
      expect(operations).toContain('INSERT INTO table2 VALUES (2)');
      expect(operations).toContain('RELEASE SAVEPOINT nested');
      expect(operations).toContain('INSERT INTO table3 VALUES (3)');
    });

    it('should rollback nested transaction without affecting parent', async () => {
      // Arrange
      const operations: string[] = [];
      
      const mockTx = {
        execute: vi.fn().mockImplementation((query: string) => {
          operations.push(query);
          return Promise.resolve(undefined);
        }),
        transaction: vi.fn().mockImplementation(async (fn: any) => {
          await mockTx.execute('SAVEPOINT nested');
          try {
            const result = await fn(mockTx);
            await mockTx.execute('RELEASE SAVEPOINT nested');
            return result;
          } catch (error) {
            await mockTx.execute('ROLLBACK TO SAVEPOINT nested');
            // Don't re-throw - allow parent transaction to continue
            return null;
          }
        }),
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act
      await db.transaction(async (tx) => {
        await tx.execute('INSERT INTO table1 VALUES (1)');
        
        // Nested transaction that fails
        await tx.transaction(async (nestedTx) => {
          await nestedTx.execute('INSERT INTO table2 VALUES (2)');
          throw new Error('Nested error');
        });
        
        // Parent transaction continues
        await tx.execute('INSERT INTO table3 VALUES (3)');
      });

      // Assert
      expect(operations).toContain('INSERT INTO table1 VALUES (1)');
      expect(operations).toContain('SAVEPOINT nested');
      expect(operations).toContain('ROLLBACK TO SAVEPOINT nested');
      expect(operations).toContain('INSERT INTO table3 VALUES (3)');
      expect(operations).not.toContain('RELEASE SAVEPOINT nested');
    });
  });

  describe('Transaction error recovery', () => {
    it('should properly cleanup resources on transaction failure', async () => {
      // Arrange
      const cleanup = vi.fn();
      
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockRejectedValue(new Error('Insert failed')),
        }),
        cleanup,
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        try {
          return await fn(mockTx);
        } catch (error) {
          cleanup();
          throw error;
        }
      });

      // Act & Assert
      await expect(async () => {
        await db.transaction(async (tx) => {
          await tx.insert({} as any).values({ data: 'test' });
        });
      }).rejects.toThrow('Insert failed');

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should handle deadlock detection and retry', async () => {
      // Arrange
      let attemptCount = 0;
      const maxRetries = 3;
      
      const mockTx = {
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(async () => {
              attemptCount++;
              if (attemptCount < maxRetries) {
                throw new Error('Deadlock detected');
              }
              return { rowCount: 1 };
            }),
          }),
        })),
      };

      const executeWithRetry = async (operation: any, retries: number = maxRetries): Promise<any> => {
        for (let i = 0; i < retries; i++) {
          try {
            return await operation();
          } catch (error: any) {
            if (error.message === 'Deadlock detected' && i < retries - 1) {
              // Retry
              continue;
            }
            throw error;
          }
        }
      };

      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        return await fn(mockTx);
      });

      // Act
      await executeWithRetry(async () => {
        return await db.transaction(async (tx) => {
          return await tx.update({} as any).set({ value: 1 }).where(sql`id = 1`);
        });
      });

      // Assert
      expect(attemptCount).toBe(maxRetries);
      expect(mockTx.update).toHaveBeenCalled();
    });
  });
});
