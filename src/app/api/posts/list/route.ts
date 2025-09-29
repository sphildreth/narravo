// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPosts } from "@/lib/posts";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import logger from '@/lib/logger';

export const dynamic = "force-dynamic"; // avoid static prerender; this route depends on request URL

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  cursor: z.object({
    publishedAt: z.string().datetime(),
    id: z.string().uuid(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse cursor from query params if present
    let cursor = null;
    const publishedAt = searchParams.get("cursor.publishedAt");
    const id = searchParams.get("cursor.id");
    if (publishedAt && id) {
      cursor = { publishedAt, id };
    }

    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit"),
      cursor,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid query parameters" } },
        { status: 400 }
      );
    }

    const { limit, cursor: validatedCursor } = parsed.data;

    // Determine cache TTL from configuration to align with home page ISR
    let sMaxAge = 60;
    let swr = 300;
    try {
      const config = new ConfigServiceImpl({ db });
      const revalidateSeconds = await config.getNumber("PUBLIC.HOME.REVALIDATE-SECONDS");
      if (typeof revalidateSeconds === "number" && !Number.isNaN(revalidateSeconds) && revalidateSeconds > 0) {
        sMaxAge = revalidateSeconds;
        swr = Math.max(60, revalidateSeconds * 5);
      }
    } catch {}

    const result = await listPosts({ 
      limit, 
      cursor: validatedCursor || null, 
      includeViews: true 
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
        "Cache-Tags": "home",
      },
    });
  } catch (error) {
    logger.error("Error in /api/posts/list:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}