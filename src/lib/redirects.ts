// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { redirects } from "@/drizzle/schema";

export type Redirect = {
  fromPath: string;
  toPath: string;
};

/**
 * Fetches all redirects from the database.
 * Caching should be handled by the caller (e.g., in middleware).
 * Best-effort: if the DB is unavailable (e.g., during static export), return an empty list.
 */
export async function getRedirects(): Promise<Redirect[]> {
  try {
    // The schema isn't fully defined, but based on Slice G, we assume
    // a `redirects` table with `from_path` and `to_path`.
    // The WXR importer creates these.
    const rowsRes: any = await db.execute(
      sql`select from_path as "fromPath", to_path as "toPath" from ${redirects}`
    );
    const rows: any[] = rowsRes.rows ?? (Array.isArray(rowsRes) ? rowsRes : []);
    return rows.map((r) => ({
      fromPath: r.fromPath,
      toPath: r.toPath,
    }));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Redirects: DB unavailable, returning empty list");
    }
    return [];
  }
}
