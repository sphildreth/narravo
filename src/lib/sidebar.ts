// SPDX-License-Identifier: Apache-2.0

/**
 * lib/sidebar.ts
 * Data helpers for the dynamic sidebar: archive-by-month and recent posts.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { listArchiveMonths, type ArchiveMonth as BaseArchiveMonth } from "./archives"; // Import from archives.ts

export type ArchiveMonth = BaseArchiveMonth & {
  key: string;       // YYYY-MM
  label: string;     // e.g., "September 2025"
};

export type RecentPost = {
  id: string;
  slug: string;
  title: string;
  publishedAt: string | null;
};

export async function getArchiveMonths(limit: number = 24): Promise<ArchiveMonth[]> {
  const months = await listArchiveMonths();
  return months.slice(0, limit).map(m => ({
    ...m,
    key: `${m.year}-${String(m.month).padStart(2, '0')}`,
    label: new Date(m.year, m.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
  }));
}

export async function getRecentPosts(limit: number = 10): Promise<RecentPost[]> {
  const res: any = await db.execute(sql`
    select id, slug, title, published_at as "publishedAt"
    from posts
    where published_at is not null
    order by published_at desc nulls last, id desc
    limit ${limit}
  `);
  const rows: any[] = res.rows ?? (Array.isArray(res) ? res : []);
  return rows.map((r:any) => ({
    id: r.id, slug: r.slug, title: r.title,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
  }));
}