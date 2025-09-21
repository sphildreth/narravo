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

// Detect a Postgres missing-column error for views_total
function isMissingViewsTotalColumn(err: unknown): boolean {
  const e = err as any;
  if (!e) return false;
  // Postgres missing column error code
  if (e.code === "42703") return true;
  const msg: string | undefined = e.message || e.cause?.message;
  return !!msg && /views_total/.test(msg);
}

export async function listPosts(opts: { cursor?: { publishedAt: string; id: string } | null; limit?: number; includeViews?: boolean } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
    const c = opts.cursor;
    const includeViewsRequested = opts.includeViews ?? false;

    const viewsSelect = includeViewsRequested ? sql`, p.views_total as "viewsTotal"` : sql``;

    // Helper to execute the query with a toggle for including views
    async function run(includeViews: boolean) {
      const selectViews = includeViews ? sql`, p.views_total as "viewsTotal"` : sql``;
      const res: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.published_at as "publishedAt"${selectViews}
    from posts p
    where true
      ${c ? sql`and (p.published_at, p.id) < (${c.publishedAt}::timestamptz, ${c.id}::uuid)` : sql``}
    order by p.published_at desc nulls last, p.id desc
    limit ${limit + 1}
  `);
      const rows: any[] = res.rows ?? (Array.isArray(res) ? res : []);
      const hasMore = rows.length > limit;
      const slice: PostDTO[] = rows.slice(0, limit).map((r:any)=>({
            id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt ?? null,
            publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
            ...(includeViews && { viewsTotal: r.viewsTotal ?? 0 })
        }));
      const last = slice.at(-1);
      const nextCursor = hasMore && last && last.publishedAt ? { publishedAt: last.publishedAt, id: last.id } : null;
      return { items: slice, nextCursor };
    }

    try {
      // Try with requested setting first
      return await run(includeViewsRequested);
    } catch (err) {
      if (includeViewsRequested && isMissingViewsTotalColumn(err)) {
        // Fallback: re-run without views_total and default to 0 in mapper
        const result = await run(false);
        // Ensure callers expecting viewsTotal still get a value
        result.items = result.items.map(p => ({ ...p, viewsTotal: (p as any).viewsTotal ?? 0 }));
        return result;
      }
      throw err;
    }
}

export async function getPostBySlug(slug: string) {
    // Helper: try with views_total, then fallback if column missing
    async function run(includeViews: boolean) {
      const selectViews = includeViews ? sql`, p.views_total as "viewsTotal"` : sql``;
      const res: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.html as "bodyHtml", 
           p.published_at as "publishedAt"${selectViews}
    from posts p
    where p.slug = ${slug}
    limit 1
  `);
      const row = (res.rows ?? [])[0];
      return row ? {
          id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt ?? null,
          bodyHtml: row.bodyHtml ?? null,
          publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
          viewsTotal: row.viewsTotal ?? 0
      } : null;
    }

    try {
      return await run(true);
    } catch (err) {
      if (isMissingViewsTotalColumn(err)) {
        return await run(false);
      }
      throw err;
    }
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

export async function countPublishedPosts(): Promise<number> {
  const rowsRes: any = await db.execute(
    sql`select count(*)::int as c from posts where published_at is not null`
  );
  return Number(rowsRes.rows?.[0]?.c ?? 0);
}
