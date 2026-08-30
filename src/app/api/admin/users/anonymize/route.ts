// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { anonymizeUser, type UsersRepo } from "@/lib/adminUsers";
import { safeApiError } from "@/lib/api-error";

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
    await requireAdmin2FA();
    const { userId, email } = await req.json();
    const repo = new DrizzleUsersRepo();
    const result = await anonymizeUser(repo, { userId, email });
    return new Response(JSON.stringify({ ok: result.ok, deleted: result.deleted, mode: result.mode }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const publicError = safeApiError(err, "Invalid anonymize request", 400);
    return new Response(JSON.stringify({ ok: false, error: { message: publicError.message } }), { status: publicError.status, headers: { "Content-Type": "application/json" } });
  }
}
