// SPDX-License-Identifier: Apache-2.0
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { logSlowQuery } from "./performance";

const url = process.env.DATABASE_URL;

let pool: any = null;
if (url) {
  pool = new Pool({ connectionString: url });
  if (process.env.NODE_ENV !== "test") {
    const originalQuery = pool.query.bind(pool);
    pool.query = (text: string, params?: any[], callback?: Function) => {
      const start = performance.now();
      const res = originalQuery(text as any, params as any, (err: any, result: any) => {
        const duration = performance.now() - start;
        try { logSlowQuery(text, duration); } catch {}
        if (callback) callback(err, result);
      });
      return res;
    };
  }
}

// When DATABASE_URL is missing, export a proxy that throws on use.
const dbOrProxy: any = pool
  ? drizzle(pool)
  : new Proxy({}, {
      get() {
        throw new Error("Database is not configured (DATABASE_URL missing)");
      }
    });

export { pool };
export const db = dbOrProxy;
