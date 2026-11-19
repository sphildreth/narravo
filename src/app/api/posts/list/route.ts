// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPosts } from "@/lib/posts";
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
    
    const publishedAt = searchParams.get("cursor.publishedAt");
    const id = searchParams.get("cursor.id");
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: publishedAt !== null || id !== null ? { publishedAt, id } : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid query parameters" } },
        { status: 400 }
      );
    }

    const { limit, cursor: validatedCursor } = parsed.data;

    const result = await listPosts({ 
      limit, 
      cursor: validatedCursor || null, 
      includeViews: true 
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
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