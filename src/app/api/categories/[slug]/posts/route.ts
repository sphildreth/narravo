// SPDX-License-Identifier: Apache-2.0

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPostsByCategory, getCategoryBySlug } from "@/lib/taxonomy";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  cursor: z.object({
    publishedAt: z.string().datetime(),
    id: z.string().uuid(),
  }).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;
    const url = new URL(req.url);
    
    // Verify category exists
    const category = await getCategoryBySlug(slug);
    if (!category) {
      return NextResponse.json(
        { error: { code: "CATEGORY_NOT_FOUND", message: "Category not found" } },
        { status: 404 }
      );
    }

    const { searchParams } = url;
    
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
    const result = await getPostsByCategory(slug, { 
      limit, 
      cursor: validatedCursor || null,
    });

    return NextResponse.json({
      category,
      ...result,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Cache-Tags": `term:${category.id}`,
      },
    });
  } catch (error) {
    // Use a fallback slug since resolvedParams might not be available in catch
    const slug = 'unknown';
    try {
      const resolvedParams = await params;
      const actualSlug = resolvedParams.slug;
      console.error(`Error in /api/categories/${actualSlug}/posts:`, error);
    } catch {
      console.error(`Error in /api/categories/${slug}/posts:`, error);
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}