// SPDX-License-Identifier: Apache-2.0
/**
 * lib/search.ts — Public post search (MVP)
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { PostDTO } from "@/types/content";

const inputSchema = z.object({
  q: z.string().trim().min(2).max(100),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

function normalizePagination(input?: { page?: number; pageSize?: number }) {
  const pageRaw = input?.page ?? 1;
  const sizeRaw = input?.pageSize ?? 10;
  const page = Math.max(1, Math.trunc(pageRaw));
  const pageSize = Math.min(50, Math.max(1, Math.trunc(sizeRaw)));
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, limit, offset };
}

export async function searchPosts(input: { q: string; page?: number; pageSize?: number }) {
  const parsed = inputSchema.safeParse({
    q: input.q,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 10,
  });
  if (!parsed.success) {
    throw new Error("Invalid search input");
  }

  const { q, page, pageSize } = parsed.data;
  const { limit, offset } = normalizePagination({ page, pageSize });
  const qLike = `%${q}%`;

  const res: any = await db.execute(sql`
    select 
      p.id,
      p.slug,
      p.title,
      p.excerpt,
      p.published_at as "publishedAt",
      (
        case when p.title ilike ${qLike} then 2 else 0 end
        + case when (p.body_html ilike ${qLike} or p.body_md ilike ${qLike}) then 1 else 0 end
        + case when p.excerpt ilike ${qLike} then 1 else 0 end
      ) as score
    from posts p
    where p.published_at is not null
      and (
        p.title ilike ${qLike}
        or p.body_html ilike ${qLike}
        or p.body_md ilike ${qLike}
        or p.excerpt ilike ${qLike}
      )
    order by score desc, p.published_at desc nulls last, p.id desc
    limit ${limit + 1}
    offset ${offset}
  `);

  const rows: any[] = res?.rows ?? [];
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);
  const items: PostDTO[] = slice.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? null,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
  }));

  return {
    items,
    pagination: {
      page,
      pageSize,
      hasMore,
    },
  } as const;
}
