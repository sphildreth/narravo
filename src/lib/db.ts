// SPDX-License-Identifier: Apache-2.0
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { logSlowQuery } from "./performance";

const url = process.env.DATABASE_URL!;

// Create connection pool with query timing instrumentation
export const pool = new Pool({ 
  connectionString: url,
  // Add query timing for performance monitoring
  ...(process.env.NODE_ENV !== 'test' && {
    // Only add instrumentation in non-test environments to avoid noise
    query: (text: string, params?: any[], callback?: Function) => {
      const start = performance.now();
      
      const originalQuery = pool.query.bind(pool);
      const result = originalQuery(text, params, (err: any, result: any) => {
        const duration = performance.now() - start;
        logSlowQuery(text, duration);
        
        if (callback) {
          callback(err, result);
        }
      });
      
      return result;
    }
  })
});

export const db = drizzle(pool);
