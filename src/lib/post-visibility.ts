// SPDX-License-Identifier: Apache-2.0
import { sql, type SQL } from "drizzle-orm";

// Raw public queries alias posts as p. Drizzle queries use the table name.
export function publicPostCondition(table: SQL = sql`p`): SQL {
  return sql`${table}.deleted_at is null and ${table}.published_at <= now()`;
}
