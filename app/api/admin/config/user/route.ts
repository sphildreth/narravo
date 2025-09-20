import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { key, userId, value } = await req.json();
    if (!key || !userId) return new Response(JSON.stringify({ ok: false, error: { message: "key and userId required" } }), { status: 400 });
    const svc = new ConfigServiceImpl({ db });
    await svc.setUserOverride(String(key), String(userId), value);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: { "Content-Type": "application/json" } });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { key, userId } = await req.json();
    if (!key || !userId) return new Response(JSON.stringify({ ok: false, error: { message: "key and userId required" } }), { status: 400 });
    const svc = new ConfigServiceImpl({ db });
    await svc.deleteUserOverride(String(key), String(userId));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: { "Content-Type": "application/json" } });
  }
}
