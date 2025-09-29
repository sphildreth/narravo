// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordView } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import logger from '@/lib/logger';

const bodySchema = z.object({
  postId: z.string().uuid(),
  sessionId: z.string().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  try {
    logger.debug("📊 View tracking API called");
    // Parse body
    const json = await req.json().catch(() => null);
    logger.debug("📊 JSON parsed:", json);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      logger.warn("📊 Validation failed:", parsed.error);
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    logger.debug("📊 Validation successful:", parsed.data);

    // Respect DNT if configured
    const config = new ConfigServiceImpl();
    const respectDnt = (await config.getBoolean("VIEW.RESPECT-DNT")) ?? false;
    const dntHeader = req.headers.get("dnt");
    if (respectDnt && dntHeader === "1") {
      return new NextResponse(null, { status: 204 });
    }

    // Collect context
    const ua = req.headers.get("user-agent") ?? undefined;
    const referer = req.headers.get("referer") ?? undefined;
    const lang = req.headers.get("accept-language") ?? undefined;
    let ip: string | undefined = undefined;
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      ip = xff.split(",")[0]?.trim();
    }
    if (!ip) {
      ip = req.headers.get("x-real-ip") ?? undefined;
    }

    // Build payload respecting exactOptionalPropertyTypes
    const payload = {
      postId: parsed.data.postId,
      ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
      ...(ip ? { ip } : {}),
      ...(ua ? { ua } : {}),
      ...(referer ? { referer } : {}),
      ...(lang ? { lang } : {}),
    } as const;

    // Record the view (best-effort)
    logger.debug("📊 About to record view with payload:", payload);
    const result = await recordView(payload as any);
    logger.debug("📊 Record view result:", result);

    // Always return 204 to avoid leaking details to clients
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Never throw; just return 204 to avoid impacting UX
    logger.error("📊 Error in view tracking API:", error);
    return new NextResponse(null, { status: 204 });
  }
}
