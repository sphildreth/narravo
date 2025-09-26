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
    const originalQuery: typeof pool.query = pool.query.bind(pool);
    // Preserve pg's overloads: (text), (text, values), (text, cb), (text, values, cb)
    pool.query = ((text: any, params?: any, callback?: any) => {
      const start = typeof performance !== "undefined" && (performance as any).now ? (performance as any).now() : Date.now();

      // Support (text, cb) signature
      if (typeof params === "function") {
        callback = params;
        params = undefined;
      }

      if (typeof callback === "function") {
        // Callback style: call original with callback and log timing
        return (originalQuery as any)(text, params, (err: any, result: any) => {
          const end = typeof performance !== "undefined" && (performance as any).now ? (performance as any).now() : Date.now();
          try { logSlowQuery(text, end - start); } catch {}
          callback(err, result);
        });
      }

      // Promise style: do not pass a callback so pg returns a Promise<QueryResult>
      const promise: Promise<any> = params !== undefined
        ? (originalQuery as any)(text, params)
        : (originalQuery as any)(text);

      return promise.then((result) => {
        const end = typeof performance !== "undefined" && (performance as any).now ? (performance as any).now() : Date.now();
        try { logSlowQuery(text, end - start); } catch {}
        return result;
      });
    }) as typeof pool.query;
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
