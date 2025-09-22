// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPosts } from "@/lib/posts";

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
    const result = await listPosts({ 
      limit, 
      cursor: validatedCursor || null, 
      includeViews: true 
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Cache-Tags": "home",
      },
    });
  } catch (error) {
    console.error("Error in /api/posts/list:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}