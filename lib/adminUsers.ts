// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface UsersRepo {
  deleteById(id: string): Promise<number>;
  deleteByEmail(email: string): Promise<number>;
}

export async function anonymizeUser(
  repo: UsersRepo,
  input: { userId?: string; email?: string }
): Promise<{ ok: boolean; deleted: number; mode: "id" | "email" }> {
  const { userId, email } = input;
  if (!userId && !email) throw new Error("userId or email required");
  if (userId && email)
    throw new Error("provide either userId or email, not both");

  if (userId) {
    const deleted = await repo.deleteById(userId);
    return { ok: deleted > 0, deleted, mode: "id" };
  } else {
    const deleted = await repo.deleteByEmail(email!);
    return { ok: deleted > 0, deleted, mode: "email" };
  }
}

export async function countUsers(): Promise<number> {
  const rows: any = await db.execute(
    sql`select count(*)::int as c from users`
  );
  return Number(rows.rows?.[0]?.c ?? 0);
}

