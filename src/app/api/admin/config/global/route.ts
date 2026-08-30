// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { ConfigServiceImpl, type ConfigType } from "@/lib/config";
import { db } from "@/lib/db";
import { revalidateAppearance } from "@/lib/revalidation";
import { safeApiError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin2FA();
    const { key, value, type, allowedValues, required } = await req.json();
    if (!key) return new Response(JSON.stringify({ ok: false, error: { message: "key required" } }), { status: 400 });
    const svc = new ConfigServiceImpl({ db });
    const opts: any = { allowedValues: allowedValues ?? null, required: Boolean(required) };
    if (typeof type !== "undefined") opts.type = type as ConfigType;
    await svc.setGlobal(String(key), value, opts);
    await svc.invalidate(String(key));
    
    // Revalidate appearance-related cache when banner settings change
    if (String(key).startsWith("APPEARANCE.BANNER.")) {
      revalidateAppearance();
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const publicError = safeApiError(err, "Invalid configuration request", 400);
    return new Response(JSON.stringify({ ok: false, error: { message: publicError.message } }), { status: publicError.status, headers: { "Content-Type": "application/json" } });
  }
}
