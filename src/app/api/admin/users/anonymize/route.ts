// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { anonymizeUser, type UsersRepo } from "@/lib/adminUsers";

class DrizzleUsersRepo implements UsersRepo {
  async deleteById(id: string): Promise<number> {
    await db.delete(users).where(eq(users.id, id));
    return 1;
  }
  async deleteByEmail(email: string): Promise<number> {
    await db.delete(users).where(eq(users.email, email));
    return 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId, email } = await req.json();
    const repo = new DrizzleUsersRepo();
    const result = await anonymizeUser(repo, { userId, email });
    return new Response(JSON.stringify({ ok: result.ok, deleted: result.deleted, mode: result.mode }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: { "Content-Type": "application/json" } });
  }
}
