// SPDX-License-Identifier: Apache-2.0
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import * as dotenv from "dotenv";
import { encryptTotpSecret } from "../src/lib/2fa/totp-secret";

dotenv.config();

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
    
    // Check if we have a migration tracking mismatch
    const migrationCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM drizzle.__drizzle_migrations
    `).catch(() => null);
    
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'posts', 'comments', 'comment_attachments')
    `);
    
    const trackedMigrations = migrationCheck?.rows[0]?.count ?? 0;
    const existingTables = parseInt(tableCheck.rows[0]?.count ?? "0");
    
    // If we have tables but no tracked migrations, warn the user
    if (existingTables > 0 && trackedMigrations === 0) {
      console.error("\n❌ MIGRATION TRACKING ERROR DETECTED");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`Your database has ${existingTables} tables, but no migrations are tracked.`);
      console.error("This usually happens when migrations were applied via 'drizzle-kit push'");
      console.error("instead of 'drizzle:migrate'.\n");
      console.error("To fix this, run the migration sync script:");
      console.error("  CONFIRM_MIGRATION_SYNC=yes pnpm tsx scripts/sync-migrations.ts\n");
      console.error("This will mark existing migrations as applied without re-running them.");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      process.exit(1);
    }
    
    console.log("🚀 Running migrations from ./drizzle/migrations...");
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });

    // Application-level data migration: encryption depends on a deployment
    // secret and therefore cannot be expressed safely in a SQL migration.
    // Compare-and-swap updates make this restart-safe and avoid overwriting a
    // concurrent TOTP rotation.
    const legacyTotp = await client.query(`
      SELECT user_id, secret_base32
      FROM owner_totp
      WHERE secret_base32 NOT LIKE 'enc:v1:%'
    `) as { rows: Array<{ user_id: string; secret_base32: string }> };
    if (legacyTotp.rows.length > 0) {
      console.log(`🔐 Encrypting ${legacyTotp.rows.length} legacy TOTP secret(s)...`);
      await client.query("BEGIN");
      try {
        for (const row of legacyTotp.rows) {
          await client.query(
            `UPDATE owner_totp
             SET secret_base32 = $1
             WHERE user_id = $2 AND secret_base32 = $3`,
            [encryptTotpSecret(row.secret_base32), row.user_id, row.secret_base32],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    
    console.log("✅ All migrations applied successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
