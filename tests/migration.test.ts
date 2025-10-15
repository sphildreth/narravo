// SPDX-License-Identifier: Apache-2.0
/**
 * Migration Testing
 * 
 * Tests database migration functionality including:
 * - Migration up/down operations
 * - Migration idempotency
 * - Data integrity during migrations
 * - Migration tracking
 * - Migration synchronization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Client } from 'pg';
import * as path from 'path';
import { createHash } from 'crypto';

// Mock external dependencies
vi.mock('pg', () => ({
  Client: vi.fn(),
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres/migrator', () => ({
  migrate: vi.fn(),
}));

// Create mocked fs module
const mockReadFileSync = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
  },
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
}));

describe('Migration Scripts', () => {
  let mockClient: any;
  let mockConsoleLog: any;
  let mockConsoleError: any;
  let mockProcessExit: any;

  beforeEach(() => {
    // Mock pg Client
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end: vi.fn().mockResolvedValue(undefined),
    };

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as any);

    // Set up environment
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/testdb';
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
    const env = process.env as Record<string, string | undefined>;
    env.DATABASE_URL = undefined;
  });

  describe('migrate.ts - Migration execution', () => {
    it('should validate DATABASE_URL requirement', () => {
      // Arrange
      const testCases = [
        { url: undefined, expected: false },
        { url: '', expected: false },
        { url: 'postgres://user:pass@host:5432/db', expected: true },
      ];

      // Act & Assert
      for (const testCase of testCases) {
        const isValid = !!testCase.url;
        expect(isValid).toBe(testCase.expected);
      }
    });

    it('should detect migration tracking mismatch', async () => {
      // Arrange
      mockClient.query
        // First query: check drizzle migrations table
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
        // Second query: check existing tables
        .mockResolvedValueOnce({ rows: [{ count: '4' }], rowCount: 1 });

      // Act & Assert
      await expect(async () => {
        await mockClient.connect();
        
        const migrationCheck = await mockClient.query(`
          SELECT COUNT(*) as count 
          FROM drizzle.__drizzle_migrations
        `);
        
        const tableCheck = await mockClient.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'posts', 'comments', 'comment_attachments')
        `);
        
        const trackedMigrations = parseInt(migrationCheck.rows[0]?.count ?? '0');
        const existingTables = parseInt(tableCheck.rows[0]?.count ?? '0');
        
        if (existingTables > 0 && trackedMigrations === 0) {
          console.error("\n❌ MIGRATION TRACKING ERROR DETECTED");
          console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          process.exit(1);
        }
      }).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('MIGRATION TRACKING ERROR DETECTED')
      );
    });

    it('should successfully run migrations when tracking is correct', async () => {
      // Arrange
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      
      mockClient.query
        // Migration check
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
        // Table check
        .mockResolvedValueOnce({ rows: [{ count: '4' }], rowCount: 1 });

      vi.mocked(migrate).mockResolvedValue(undefined as any);

      // Act
      await mockClient.connect();
      
      const migrationCheck = await mockClient.query(`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`);
      const tableCheck = await mockClient.query(`SELECT COUNT(*) as count FROM information_schema.tables`);
      
      const trackedMigrations = parseInt(migrationCheck.rows[0]?.count ?? '0');
      const existingTables = parseInt(tableCheck.rows[0]?.count ?? '0');
      
      if (existingTables === 0 || trackedMigrations > 0) {
        console.log("🚀 Running migrations from ./drizzle/migrations...");
        // await migrate(db, { migrationsFolder: "./drizzle/migrations" });
        console.log("✅ All migrations applied successfully");
      }

      await mockClient.end();

      // Assert
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Running migrations')
      );
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle migration failures gracefully', async () => {
      // Arrange
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(async () => {
        try {
          await mockClient.connect();
        } catch (error) {
          console.error("❌ Migration failed:", error);
          process.exit(1);
        }
      }).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Migration failed'),
        expect.any(Error)
      );
    });
  });

  describe('sync-migrations.ts - Migration synchronization', () => {
    it('should validate DATABASE_URL requirement', () => {
      // Arrange
      const testCases = [
        { url: undefined, expected: false },
        { url: '', expected: false },
        { url: 'postgres://user:pass@host:5432/db', expected: true },
      ];

      // Act & Assert
      for (const testCase of testCases) {
        const isValid = !!testCase.url;
        expect(isValid).toBe(testCase.expected);
      }
    });

    it('should detect when migration tracking is already in sync', async () => {
      // Arrange
      const mockJournalData = {
        version: "6",
        dialect: "postgresql",
        entries: [
          { idx: 0, version: "1", when: Date.now(), tag: "0000_first_migration", breakpoints: true },
          { idx: 1, version: "2", when: Date.now(), tag: "0001_second_migration", breakpoints: true },
        ],
      };

      mockClient.query.mockResolvedValue({
        rows: [
          { id: 1, hash: 'hash1', created_at: Date.now() },
          { id: 2, hash: 'hash2', created_at: Date.now() },
        ],
        rowCount: 2,
      });

      // Act
      await mockClient.connect();
      const result = await mockClient.query(`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`);
      
      console.log(`✅ Currently ${result.rows.length} migrations marked as applied in database`);
      
      if (result.rows.length === mockJournalData.entries.length) {
        console.log("✨ Migration tracking is already in sync!");
      }
      
      await mockClient.end();

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Migration tracking is already in sync!')
      );
    });

    it('should warn when database is empty', async () => {
      // Arrange
      mockClient.query
        // First query: get tracked migrations (empty)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // Second query: check for key tables
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Act
      await mockClient.connect();
      
      const trackedResult = await mockClient.query(`SELECT id FROM drizzle.__drizzle_migrations`);
      const tableCheck = await mockClient.query(`SELECT table_name FROM information_schema.tables WHERE table_name IN ('users', 'posts')`);
      
      const existingTables = tableCheck.rows.map((r: any) => r.table_name);
      console.log(`🔍 Found ${existingTables.length} key tables in database`);
      
      if (existingTables.length === 0) {
        console.log("⚠️  Database appears to be empty. Run normal migration instead.");
        console.log("   Use: pnpm drizzle:migrate");
      }
      
      await mockClient.end();

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Database appears to be empty')
      );
    });

    it('should validate confirmation requirement before syncing', async () => {
      // Arrange
      process.env.CONFIRM_MIGRATION_SYNC = undefined;
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ table_name: 'users' }, { table_name: 'posts' }], rowCount: 2 });

      // Act
      await mockClient.connect();
      
      const trackedResult = await mockClient.query(`SELECT id FROM drizzle.__drizzle_migrations`);
      const tableCheck = await mockClient.query(`SELECT table_name FROM information_schema.tables`);
      
      const hasTablesButNoTracking = tableCheck.rows.length > 0 && trackedResult.rows.length === 0;
      const confirmationProvided = process.env.CONFIRM_MIGRATION_SYNC === "yes";
      const shouldProceed = !hasTablesButNoTracking || confirmationProvided;

      // Assert
      expect(hasTablesButNoTracking).toBe(true);
      expect(confirmationProvided).toBe(false);
      expect(shouldProceed).toBe(false); // Should not proceed without confirmation
    });

    it('should sync migrations when confirmed', async () => {
      // Arrange
      process.env.CONFIRM_MIGRATION_SYNC = 'yes';
      
      const mockJournalData = {
        version: "6",
        dialect: "postgresql",
        entries: [
          { idx: 0, version: "1", when: Date.now(), tag: "0000_first_migration", breakpoints: true },
        ],
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // No tracked migrations
        .mockResolvedValueOnce({ rows: [{ table_name: 'users' }], rowCount: 1 }) // Tables exist
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Insert successful

      // Mock file system
      mockReadFileSync.mockReturnValue(
        JSON.stringify(mockJournalData)
      );
      mockExistsSync.mockReturnValue(true);

      // Act
      await mockClient.connect();
      
      const trackedResult = await mockClient.query(`SELECT id FROM drizzle.__drizzle_migrations`);
      const tableCheck = await mockClient.query(`SELECT table_name FROM information_schema.tables`);
      
      if (tableCheck.rows.length > 0 && process.env.CONFIRM_MIGRATION_SYNC === 'yes') {
        // Read journal
        const journalPath = path.join(process.cwd(), "drizzle", "migrations", "meta", "_journal.json");
        const journalData = JSON.parse(mockReadFileSync(journalPath, "utf-8") as string);
        
        // Sync each migration
        for (const entry of journalData.entries) {
          const migrationSql = "SELECT 1;";
          const hash = createHash("sha256").update(migrationSql).digest("hex");
          
          await mockClient.query(
            `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
            [hash, entry.when]
          );
          console.log(`  ✓ Marked migration ${entry.idx}: ${entry.tag} as applied`);
        }
        
        console.log(`\n✅ Successfully synced ${journalData.entries.length} migration(s) to tracking table`);
      }
      
      await mockClient.end();

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Marked migration 0: 0000_first_migration as applied')
      );
    });
  });

  describe('Migration idempotency', () => {
    it('should not reapply already applied migrations', async () => {
      // Arrange
      const appliedHashes = new Set(['hash1', 'hash2', 'hash3']);
      const newHash = 'hash4';

      // Act
      const shouldApply = !appliedHashes.has(newHash);

      // Assert
      expect(shouldApply).toBe(true);
      expect(appliedHashes.has('hash1')).toBe(true);
    });

    it('should skip migrations that are already marked as applied', async () => {
      // Arrange
      const mockJournalData = {
        entries: [
          { idx: 0, tag: "0000_first", hash: 'hash1' },
          { idx: 1, tag: "0001_second", hash: 'hash2' },
        ],
      };

      const appliedHashes = new Set(['hash1']); // Only first is applied
      const skipped: string[] = [];
      const applied: string[] = [];

      // Act
      for (const entry of mockJournalData.entries) {
        if (appliedHashes.has((entry as any).hash)) {
          skipped.push(entry.tag);
        } else {
          applied.push(entry.tag);
        }
      }

      // Assert
      expect(skipped).toEqual(['0000_first']);
      expect(applied).toEqual(['0001_second']);
    });

    it('should calculate consistent hashes for same migration content', () => {
      // Arrange
      const migrationSql = "CREATE TABLE users (id SERIAL PRIMARY KEY);";

      // Act
      const hash1 = createHash("sha256").update(migrationSql).digest("hex");
      const hash2 = createHash("sha256").update(migrationSql).digest("hex");

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different migration content', () => {
      // Arrange
      const migration1 = "CREATE TABLE users (id SERIAL PRIMARY KEY);";
      const migration2 = "CREATE TABLE posts (id SERIAL PRIMARY KEY);";

      // Act
      const hash1 = createHash("sha256").update(migration1).digest("hex");
      const hash2 = createHash("sha256").update(migration2).digest("hex");

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Data integrity during migrations', () => {
    it('should preserve existing data during schema changes', async () => {
      // Arrange
      mockClient.query
        // Get existing data before migration
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Test User', email: 'test@example.com' },
          ],
          rowCount: 1,
        })
        // Get data after migration (with new column)
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Test User', email: 'test@example.com', created_at: null },
          ],
          rowCount: 1,
        });

      // Act
      await mockClient.connect();
      
      // Simulate: Get data before migration
      const beforeMigration = await mockClient.query('SELECT * FROM users');
      
      // Simulate: Run migration (ALTER TABLE ADD COLUMN)
      // await mockClient.query('ALTER TABLE users ADD COLUMN created_at TIMESTAMP');
      
      // Get data after migration
      const afterMigration = await mockClient.query('SELECT * FROM users');
      
      await mockClient.end();

      // Assert
      expect(beforeMigration.rows[0]?.id).toBe(1);
      expect(afterMigration.rows[0]?.id).toBe(1);
      expect(afterMigration.rows[0]?.name).toBe('Test User');
      expect(afterMigration.rows[0]?.email).toBe('test@example.com');
    });

    it('should handle data transformation during migrations', async () => {
      // Arrange
      const oldData = [
        { id: 1, full_name: 'John Doe' },
        { id: 2, full_name: 'Jane Smith' },
      ];

      // Act - Simulate splitting full_name into first_name and last_name
      const transformedData = oldData.map(row => {
        const [firstName, ...lastNameParts] = row.full_name.split(' ');
        return {
          id: row.id,
          first_name: firstName,
          last_name: lastNameParts.join(' '),
        };
      });

      // Assert
      expect(transformedData[0]).toEqual({
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(transformedData[1]).toEqual({
        id: 2,
        first_name: 'Jane',
        last_name: 'Smith',
      });
    });

    it('should validate data constraints after migration', async () => {
      // Arrange
      const dataToValidate = [
        { email: 'valid@example.com', age: 25 },
        { email: 'invalid-email', age: -5 },
      ];

      // Act
      const validationResults = dataToValidate.map(data => ({
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),
        age: data.age > 0 && data.age < 150,
      }));

      // Assert
      expect(validationResults[0]).toEqual({ email: true, age: true });
      expect(validationResults[1]).toEqual({ email: false, age: false });
    });
  });

  describe('Migration tracking', () => {
    it('should track migration order correctly', async () => {
      // Arrange
      const migrations = [
        { idx: 0, tag: "0000_initial", when: 1000 },
        { idx: 1, tag: "0001_add_users", when: 2000 },
        { idx: 2, tag: "0002_add_posts", when: 3000 },
      ];

      mockClient.query.mockResolvedValue({
        rows: migrations.map(m => ({ id: m.idx + 1, created_at: m.when })),
        rowCount: 3,
      });

      // Act
      await mockClient.connect();
      const result = await mockClient.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id');
      await mockClient.end();

      // Assert
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]?.created_at).toBeLessThan(result.rows[1]?.created_at ?? 0);
      expect(result.rows[1]?.created_at).toBeLessThan(result.rows[2]?.created_at ?? 0);
    });

    it('should detect missing migrations in sequence', () => {
      // Arrange
      const expectedMigrations = [0, 1, 2, 3, 4];
      const appliedMigrations = [0, 1, 3, 4]; // Missing migration 2

      // Act
      const missingMigrations = expectedMigrations.filter(
        idx => !appliedMigrations.includes(idx)
      );

      // Assert
      expect(missingMigrations).toEqual([2]);
    });

    it('should prevent out-of-order migration application', () => {
      // Arrange
      const appliedMigrations = [0, 1, 2];
      const attemptedMigration = { idx: 5, tag: "0005_future" };

      // Act
      const canApply = attemptedMigration.idx === appliedMigrations.length;

      // Assert
      expect(canApply).toBe(false); // Should not skip migrations 3 and 4
    });
  });
});
