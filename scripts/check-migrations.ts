// SPDX-License-Identifier: Apache-2.0
/**
 * Checks the current migration status and shows which migrations have been applied.
 * Useful for debugging migration issues and verifying database state.
 */

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

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
    
    // Read the journal file
    const journalPath = path.join(process.cwd(), "drizzle", "migrations", "meta", "_journal.json");
    const journalData: JournalData = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    
    console.log("\n📋 MIGRATION FILES");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Total migrations in ./drizzle/migrations: ${journalData.entries.length}`);
    
    // Check what's in the database
    const migrationTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      ) as exists
    `);
    
    if (!migrationTableExists.rows[0]?.exists) {
      console.log("\n⚠️  Migration tracking table doesn't exist yet.");
      console.log("   Run migrations for the first time with: pnpm drizzle:migrate");
      await client.end();
      return;
    }
    
    const appliedMigrationsResult = await client.query(`
      SELECT id, hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY id
    `);
    
    console.log(`\n✅ APPLIED MIGRATIONS (${appliedMigrationsResult.rows.length})`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (appliedMigrationsResult.rows.length === 0) {
      console.log("No migrations have been applied yet.");
    } else {
      for (const row of appliedMigrationsResult.rows) {
        const date = new Date(parseInt(row.created_at));
        console.log(`  ${row.id}. ${date.toISOString()} - Hash: ${row.hash.substring(0, 12)}...`);
      }
    }
    
    // Check database tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\n📊 DATABASE TABLES (${tablesResult.rows.length})`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const tables = tablesResult.rows.map((r: { table_name: string }) => r.table_name);
    const columnCount = 3;
    for (let i = 0; i < tables.length; i += columnCount) {
      const row = tables.slice(i, i + columnCount);
      console.log(`  ${row.map((t: string) => t.padEnd(25)).join(" ")}`);
    }
    
    // Status summary
    console.log("\n🔍 STATUS SUMMARY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const diff = journalData.entries.length - appliedMigrationsResult.rows.length;
    
    if (diff === 0) {
      console.log("✅ All migrations are applied and tracked correctly.");
    } else if (diff > 0) {
      console.log(`⚠️  ${diff} migration(s) not yet applied.`);
      console.log("   Run: pnpm drizzle:migrate");
      
      // If we have tables but no migrations, this is the sync issue
      if (tables.length > 0 && appliedMigrationsResult.rows.length === 0) {
        console.log("\n⚠️  WARNING: You have tables but no tracked migrations!");
        console.log("   This means migrations were applied via 'drizzle-kit push'.");
        console.log("   Fix this with: CONFIRM_MIGRATION_SYNC=yes pnpm tsx scripts/sync-migrations.ts");
      }
    } else {
      console.log(`⚠️  Database has more migrations tracked than exist in files (${Math.abs(diff)} extra)`);
      console.log("   This shouldn't happen. Check your migration files.");
    }
    
    console.log();
    
  } catch (error) {
    console.error("❌ Check failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
