// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { recordView, recordPageView, pruneViewEvents } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import logger from '@/lib/logger';
import { consumeSharedRateLimit, pruneExpiredRateLimitBuckets } from "@/lib/shared-rate-limit";

const postViewSchema = z.object({
  postId: z.string().uuid(),
  sessionId: z.string().min(1).max(128).optional(),
});

const pageViewSchema = z.object({
  type: z.literal("page"),
  path: z.string().min(1).max(255).refine((path) => path.startsWith("/") && !path.startsWith("//")),
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

export async function POST(req: NextRequest) {
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

    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      return new NextResponse(null, { status: 204 });
    }

    const globalLimit = await consumeSharedRateLimit("analytics:view:global", 3000, 60 * 1000);
    if (globalLimit.limited) return new NextResponse(null, { status: 204 });
    const cookieName = process.env.NODE_ENV === "production" ? "__Host-viewSession" : "viewSession";
    const existingSession = (req as NextRequest).cookies?.get(cookieName)?.value;
    const hasValidExistingSession = !!existingSession && /^[a-f\d-]{36}$/i.test(existingSession);
    const serverSessionId = hasValidExistingSession ? existingSession : randomUUID();
    const sessionLimit = await consumeSharedRateLimit(`analytics:view:${serverSessionId}`, 60, 60 * 1000);
    if (sessionLimit.limited) return new NextResponse(null, { status: 204 });

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
        sessionId: serverSessionId,
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
        sessionId: serverSessionId,
        ...(ip ? { ip } : {}),
        ...(ua ? { ua } : {}),
        ...(referer ? { referer } : {}),
        ...(lang ? { lang } : {}),
      } as const;

      logger.debug("📊 About to record post view with payload:", payload);
      result = await recordView(payload as any);
    }
    
    logger.debug("📊 Record view result:", result);

    const cleanupLimit = await consumeSharedRateLimit("maintenance:analytics-retention", 1, 24 * 60 * 60 * 1000);
    if (!cleanupLimit.limited) {
      try { await pruneViewEvents(90); } catch (error) { logger.error("Analytics retention cleanup failed", error); }
    }
    // The public endpoint can legitimately create one short-lived bucket per
    // browser. Clean at least as quickly as the global admission budget can
    // create expired rows so attacker-chosen cookie values cannot grow this
    // table without bound.
    const rateLimitCleanup = await consumeSharedRateLimit("maintenance:rate-limit-retention", 1, 60 * 1000);
    if (!rateLimitCleanup.limited) {
      try { await pruneExpiredRateLimitBuckets(10_000); } catch (error) { logger.error("Rate-limit retention cleanup failed", error); }
    }

    // Always return 204 to avoid leaking details to clients.
    const response = new NextResponse(null, { status: 204 });
    if (!hasValidExistingSession) {
      response.cookies.set(cookieName, serverSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (error) {
    // Never throw; just return 204 to avoid impacting UX
    logger.error("📊 Error in view tracking API:", error);
    return new NextResponse(null, { status: 204 });
  }
}
