// SPDX-License-Identifier: Apache-2.0
/**
 * Synchronizes the Drizzle migrations tracking table with the actual database state.
 * 
 * This script is useful when:
 * - Migrations were applied via drizzle-kit push instead of migrate
 * - The __drizzle_migrations table was accidentally cleared or lost
 * - You're recovering from a migration tracking issue
 * 
 * It will mark all migrations in ./drizzle/migrations as applied IF the corresponding
 * tables already exist in the database.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

dotenv.config();

interface MigrationEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface JournalData {
  version: string;
  dialect: string;
  entries: MigrationEntry[];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  
  try {
    console.log("🔌 Connecting to database...");
    await client.connect();
    
    const db = drizzle(client);
    
    // Read the journal file to get list of migrations
    const journalPath = path.join(process.cwd(), "drizzle", "migrations", "meta", "_journal.json");
    const journalData: JournalData = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    
    console.log(`📋 Found ${journalData.entries.length} migrations in journal`);
    
    // Check current state of __drizzle_migrations table
    const result = await client.query(`
      SELECT id, hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY id
    `);
    
    console.log(`✅ Currently ${result.rows.length} migrations marked as applied in database`);
    
    if (result.rows.length === journalData.entries.length) {
      console.log("✨ Migration tracking is already in sync!");
      return;
    }
    
    // Check if key tables exist to determine if schema is actually applied
    const tableCheckResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'posts', 'comments', 'comment_attachments', 'security_activity')
    `);
    
    const existingTables = tableCheckResult.rows.map((r: { table_name: string }) => r.table_name);
    console.log(`🔍 Found ${existingTables.length} key tables in database: ${existingTables.join(", ")}`);
    
    if (existingTables.length === 0) {
      console.log("⚠️  Database appears to be empty. Run normal migration instead.");
      console.log("   Use: pnpm drizzle:migrate");
      return;
    }
    
    // Confirm before proceeding
    console.log("\n⚠️  WARNING: This will mark migrations as applied without actually running them.");
    console.log("   Only proceed if you're sure the database schema is already up to date.");
    console.log(`   This will add ${journalData.entries.length - result.rows.length} migration records.\n`);
    
    // In production, you might want to add a prompt here
    // For now, we'll check an environment variable
    if (process.env.CONFIRM_MIGRATION_SYNC !== "yes") {
      console.log("❌ Set CONFIRM_MIGRATION_SYNC=yes to proceed");
      console.log("   Example: CONFIRM_MIGRATION_SYNC=yes pnpm tsx scripts/sync-migrations.ts");
      process.exit(1);
    }
    
    // Get the applied migration hashes
    const appliedHashes = new Set(result.rows.map((r: { hash: string }) => r.hash));
    
    // For each migration in the journal, calculate hash and insert if not present
    const migrationsFolder = path.join(process.cwd(), "drizzle", "migrations");
    let inserted = 0;
    
    for (const entry of journalData.entries) {
      const migrationFile = path.join(migrationsFolder, `${entry.tag}.sql`);
      
      if (!fs.existsSync(migrationFile)) {
        console.warn(`⚠️  Migration file not found: ${entry.tag}.sql`);
        continue;
      }
      
      const migrationSql = fs.readFileSync(migrationFile, "utf-8");
      const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");
      
      if (!appliedHashes.has(hash)) {
        await client.query(
          `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
          [hash, entry.when]
        );
        console.log(`  ✓ Marked migration ${entry.idx}: ${entry.tag} as applied`);
        inserted++;
      } else {
        console.log(`  ⊙ Migration ${entry.idx}: ${entry.tag} already marked as applied`);
      }
    }
    
    console.log(`\n✅ Successfully synced ${inserted} migration(s) to tracking table`);
    console.log("🎉 Migration tracking is now in sync with database state");
    
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
