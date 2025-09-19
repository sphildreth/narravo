
/**
 * lib/posts.ts
 * RSC-friendly queries for posts (list + detail) with cache revalidation tags.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export type PostDTO = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyHtml?: string | null;
  publishedAt: string | null;
  author?: { name: string | null; image: string | null } | null;
};

export async function listPosts(opts: { cursor?: { publishedAt: string; id: string } | null; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const c = opts.cursor;
  const rowsRes: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.published_at as "publishedAt",
           u.name as "authorName", u.image as "authorImage"
    from posts p
    left join users u on u.id = p.author_id
    where p.status = 'published'
      ${c ? sql`and (p.published_at, p.id) < (${c.publishedAt}::timestamptz, ${c.id}::uuid)` : sql``}
    order by p.published_at desc nulls last, p.id desc
    limit ${limit + 1}
  `);
  const rows: any[] = rowsRes.rows ?? (Array.isArray(rowsRes) ? rowsRes : []);
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit).map((r:any)=>({
    id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt ?? null,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    author: { name: r.authorName ?? null, image: r.authorImage ?? null }
  }));
  const nextCursor = hasMore && slice.length > 0 ? { publishedAt: slice[slice.length-1].publishedAt!, id: slice[slice.length-1].id } : null;
  return { items: slice, nextCursor };
}

export async function getPostBySlug(slug: string) {
  const res: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.body_html as "bodyHtml", p.published_at as "publishedAt",
           u.name as "authorName", u.image as "authorImage"
    from posts p
    left join users u on u.id = p.author_id
    where p.slug = ${slug} and p.status = 'published'
    limit 1
  `);
  const row = (res.rows ?? [])[0];
  return row ? {
    id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt ?? null,
    bodyHtml: row.bodyHtml ?? null,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    author: { name: row.authorName ?? null, image: row.authorImage ?? null }
  } : null;
}
