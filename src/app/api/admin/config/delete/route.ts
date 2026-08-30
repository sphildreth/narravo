// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { safeApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin2FA();
    const { key } = await req.json();
    if (!key) return new Response(JSON.stringify({ ok: false, error: { message: "key required" } }), { status: 400 });
    const svc = new ConfigServiceImpl({ db });
    await svc.deleteGlobal(String(key));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const publicError = safeApiError(err, "Invalid configuration request", 400);
    return new Response(JSON.stringify({ ok: false, error: { message: publicError.message } }), { status: publicError.status, headers: { "Content-Type": "application/json" } });
  }
}
