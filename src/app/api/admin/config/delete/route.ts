// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { key } = await req.json();
    if (!key) return new Response(JSON.stringify({ ok: false, error: { message: "key required" } }), { status: 400 });
    const svc = new ConfigServiceImpl({ db });
    await svc.deleteGlobal(String(key));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: { "Content-Type": "application/json" } });
  }
}

