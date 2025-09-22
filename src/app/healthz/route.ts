// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const revalidate = 0; // Do not cache

export async function GET() {
  try {
    // Drizzle doesn't have a dedicated `db.ping()`. 
    // A simple query is the recommended way to check health.
    await db.execute(sql`select 1`);
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("/healthz error:", error);
    return new Response(`DB health check failed: ${error.message}`, {
      status: 503, // Service Unavailable
    });
  }
}
