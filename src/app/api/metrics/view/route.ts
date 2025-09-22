// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { recordView } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { posts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const config = new ConfigServiceImpl({ db });

// In-memory rate limiter for development
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "127.0.0.1";
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback for development
  return "127.0.0.1";
}

function isRateLimited(ip: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  const current = rateLimitMap.get(ip);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (current.count >= limit) {
    return true;
  }
  
  current.count++;
  return false;
}

const requestSchema = z.object({
  postId: z.string().uuid("Invalid post ID format"),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Invalid request format" } },
        { status: 400 }
      );
    }

    const { postId, sessionId } = parsed.data;

    // Check DNT header
    const dnt = request.headers.get("dnt");
    const respectDnt = await config.getBoolean("VIEW.RESPECT-DNT");
    
    if (respectDnt && dnt === "1") {
      return new NextResponse(null, { status: 204 });
    }

    // Get client IP and check rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = await config.getNumber("RATE.VIEWS-PER-MINUTE") ?? 120;
    
    if (isRateLimited(clientIp, rateLimit)) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { 
          status: 429,
          headers: { "Retry-After": "60" }
        }
      );
    }

    // Verify post exists
    const postExists = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (postExists.length === 0) {
      // Return 204 to avoid probing as per requirements
      return new NextResponse(null, { status: 204 });
    }

    // Extract headers for analytics
    const userAgent = request.headers.get("user-agent") || undefined;
    const referer = request.headers.get("referer") || undefined;
    const acceptLanguage = request.headers.get("accept-language") || undefined;

    // Record the view
    const recordViewInput: any = {
      postId,
      ip: clientIp,
      ua: userAgent,
      referer,
      lang: acceptLanguage,
    };
    
    if (sessionId) {
      recordViewInput.sessionId = sessionId;
    }
    
    await recordView(recordViewInput);

    return new NextResponse(null, { status: 204 });
    
  } catch (error) {
    console.error("Error recording view:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}