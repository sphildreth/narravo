// SPDX-License-Identifier: Apache-2.0
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import * as dotenv from "dotenv";

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
    
    console.log("🚀 Running migrations from ./drizzle/migrations...");
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    
    console.log("✅ All migrations applied successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
