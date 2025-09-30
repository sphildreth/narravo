// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordView, recordPageView } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import logger from '@/lib/logger';

const postViewSchema = z.object({
  postId: z.string().uuid(),
  sessionId: z.string().min(1).max(128).optional(),
});

const pageViewSchema = z.object({
  type: z.literal("page"),
  path: z.string().min(1).max(255),
  sessionId: z.string().min(1).max(128).optional(),
});

const legacyPostViewSchema = z.object({
  postId: z.string().uuid(),
  sessionId: z.string().min(1).max(128).optional(),
});

const bodySchema = z.union([
  pageViewSchema,
  postViewSchema,
  legacyPostViewSchema,
]);

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

    // Handle different types of view tracking
    let result: boolean;
    
    if ("type" in parsed.data && parsed.data.type === "page") {
      // Page view tracking
      const payload = {
        path: parsed.data.path,
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
        ...(ip ? { ip } : {}),
        ...(ua ? { ua } : {}),
        ...(referer ? { referer } : {}),
        ...(lang ? { lang } : {}),
      } as const;

      logger.debug("📊 About to record page view with payload:", payload);
      result = await recordPageView(payload as any);
    } else {
      // Post view tracking (legacy and new format)
      const postData = parsed.data as { postId: string; sessionId?: string };
      const payload = {
        postId: postData.postId,
        ...(postData.sessionId ? { sessionId: postData.sessionId } : {}),
        ...(ip ? { ip } : {}),
        ...(ua ? { ua } : {}),
        ...(referer ? { referer } : {}),
        ...(lang ? { lang } : {}),
      } as const;

      logger.debug("📊 About to record post view with payload:", payload);
      result = await recordView(payload as any);
    }
    
    logger.debug("📊 Record view result:", result);

    // Always return 204 to avoid leaking details to clients
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Never throw; just return 204 to avoid impacting UX
    logger.error("📊 Error in view tracking API:", error);
    return new NextResponse(null, { status: 204 });
  }
}
