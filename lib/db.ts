import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL!;
export const pool = new Pool({ connectionString: url });
export const db = drizzle(pool);
