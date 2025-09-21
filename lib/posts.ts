// SPDX-License-Identifier: Apache-2.0
/**
 * lib/posts.ts — schema-aligned version (no `status`, uses `html` column)
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { PostDTO } from "@/src/types/content";
import { getReactionCounts, getUserReactions, type ReactionCounts, type UserReactions } from "./reactions";

function normalizePagination(input?: { page?: number; pageSize?: number }) {
  const pageRaw = input?.page ?? 1;
  const sizeRaw = input?.pageSize ?? 10;
  const page = Math.max(1, Math.trunc(pageRaw));
  const pageSize = Math.min(50, Math.max(1, Math.trunc(sizeRaw)));
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, limit, offset };
}

export const __testables__ = { normalizePagination };

export async function listPosts(opts: { cursor?: { publishedAt: string; id: string } | null; limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
    const c = opts.cursor;
    const rowsRes: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.published_at as "publishedAt"
    from posts p
    where true
      ${c ? sql`and (p.published_at, p.id) < (${c.publishedAt}::timestamptz, ${c.id}::uuid)` : sql``}
    order by p.published_at desc nulls last, p.id desc
    limit ${limit + 1}
  `);
    const rows: any[] = rowsRes.rows ?? (Array.isArray(rowsRes) ? rowsRes : []);
    const hasMore = rows.length > limit;
    const slice: PostDTO[] = rows.slice(0, limit).map((r:any)=>({
          id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt ?? null,
          publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      }));
    const last = slice.at(-1);
    const nextCursor = hasMore && last && last.publishedAt ? { publishedAt: last.publishedAt, id: last.id } : null;
    return { items: slice, nextCursor };
}

export async function getPostBySlug(slug: string) {
    const res: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.html as "bodyHtml", p.published_at as "publishedAt"
    from posts p
    where p.slug = ${slug}
    limit 1
  `);
    const row = (res.rows ?? [])[0];
    return row ? {
        id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt ?? null,
        bodyHtml: row.bodyHtml ?? null,
        publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null
    } : null;
}

/**
 * Get post with reaction data for a specific user
 */
export async function getPostBySlugWithReactions(slug: string, userId?: string) {
    const post = await getPostBySlug(slug);
    if (!post) return null;

    const reactionCounts = await getReactionCounts("post", post.id);
    const userReactions = userId ? await getUserReactions("post", post.id, userId) : {};

    return {
        ...post,
        reactions: {
            counts: reactionCounts,
            userReactions,
        },
    };
}
