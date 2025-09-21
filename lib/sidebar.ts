// SPDX-License-Identifier: Apache-2.0

/**
 * lib/sidebar.ts
 * Data helpers for the dynamic sidebar: archive-by-month and recent posts.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export type ArchiveMonth = {
  year: number;
  month: number;     // 1-12
  key: string;       // YYYY-MM
  label: string;     // e.g., "September 2025"
  count: number;
};

export type RecentPost = {
  id: string;
  slug: string;
  title: string;
  publishedAt: string | null;
};

export async function getArchiveMonths(limit: number = 24): Promise<ArchiveMonth[]> {
  const rowsRes: any = await db.execute(sql`
    with base as (
      select coalesce(p.published_at, p.created_at) as dt
      from posts p
      where coalesce(p.published_at, p.created_at) is not null
    )
    select
      extract(year from dt)::int as year,
      extract(month from dt)::int as month,
      to_char(date_trunc('month', dt), 'YYYY-MM') as key,
      to_char(date_trunc('month', dt), 'FMMonth YYYY') as label,
      count(*)::int as count
    from base
    group by 1,2,3,4
    order by year desc, month desc
    limit ${limit}
  `);
  const rows: any[] = rowsRes.rows ?? (Array.isArray(rowsRes) ? rowsRes : []);
  return rows.map((r:any) => ({
    year: Number(r.year), month: Number(r.month), key: String(r.key), label: String(r.label), count: Number(r.count)
  }));
}

export async function getRecentPosts(limit: number = 10): Promise<RecentPost[]> {
  const res: any = await db.execute(sql`
    select id, slug, title, coalesce(published_at, created_at) as "publishedAt"
    from posts
    order by coalesce(published_at, created_at) desc nulls last, id desc
    limit ${limit}
  `);
  const rows: any[] = res.rows ?? (Array.isArray(res) ? res : []);
  return rows.map((r:any) => ({
    id: r.id, slug: r.slug, title: r.title,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
  }));
}
