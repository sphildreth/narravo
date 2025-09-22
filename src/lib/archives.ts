// SPDX-License-Identifier: Apache-2.0
import { db } from "./db";
import { sql } from "drizzle-orm";

export interface ArchiveMonth {
  year: number;
  month: number;
  count: number;
}

export interface PostArchiveItem {
  slug: string;
  title: string;
  publishedAt: Date;
}

export function getArchiveCacheTag(year: number, month?: number): string {
  if (month) {
    return `archive:${year}-${String(month).padStart(2, '0')}`;
  }
  return `archive:${year}`;
}

export function validateArchiveParams(year?: string, month?: string): { isValid: boolean; yearNum?: number; monthNum?: number; error?: string } {
  if (!year || !/^\d{4}$/.test(year)) {
    return { isValid: false, error: "Invalid year" };
  }
  const y = Number(year);
  const currentYear = new Date().getFullYear();
  if (y < 2000 || y > currentYear) {
    return { isValid: false, error: "Invalid year" };
  }
  if (month != null) {
    if (!/^\d{1,2}$/.test(month)) return { isValid: false, error: "Invalid month" };
    const m = Number(month);
    if (m < 1 || m > 12) return { isValid: false, error: "Invalid month" };
    return { isValid: true, yearNum: y, monthNum: m };
  }
  return { isValid: true, yearNum: y };
}

export async function listArchiveMonths(): Promise<ArchiveMonth[]> {
  const res: any = await db.execute(sql`
    select extract(year from p.published_at)::int as year,
           extract(month from p.published_at)::int as month,
           count(*)::int as count
      from posts p
     where p.published_at is not null
     group by 1,2
     order by 1 desc, 2 desc
  `);
  const rows: any[] = res.rows ?? [];
  return rows.map((r) => ({ year: Number(r.year), month: Number(r.month), count: Number(r.count) }));
}

export async function getPostsByYear(year: number, page: number = 1, pageSize: number = 10): Promise<PostArchiveItem[]> {
  const limit = Math.min(Math.max(pageSize, 1), 50);
  const offset = Math.max(0, (Math.max(1, page) - 1) * limit);
  const res: any = await db.execute(sql`
    select p.slug, p.title, p.published_at as "publishedAt"
      from posts p
     where p.published_at is not null
       and extract(year from p.published_at) = ${year}
     order by p.published_at desc nulls last, p.id desc
     limit ${limit} offset ${offset}
  `);
  const rows: any[] = res.rows ?? [];
  return rows.map((r) => ({ slug: r.slug, title: r.title, publishedAt: new Date(r.publishedAt) }));
}

export async function getPostsByYearAndMonth(year: number, month: number, page: number = 1, pageSize: number = 10): Promise<PostArchiveItem[]> {
  const limit = Math.min(Math.max(pageSize, 1), 50);
  const offset = Math.max(0, (Math.max(1, page) - 1) * limit);
  const res: any = await db.execute(sql`
    select p.slug, p.title, p.published_at as "publishedAt"
      from posts p
     where p.published_at is not null
       and extract(year from p.published_at) = ${year}
       and extract(month from p.published_at) = ${month}
     order by p.published_at desc nulls last, p.id desc
     limit ${limit} offset ${offset}
  `);
  const rows: any[] = res.rows ?? [];
  return rows.map((r) => ({ slug: r.slug, title: r.title, publishedAt: new Date(r.publishedAt) }));
}

export async function getPostCountByYearAndMonth(year: number, month: number): Promise<number> {
  const res: any = await db.execute(sql`
    select count(*)::int as c
      from posts p
     where p.published_at is not null
       and extract(year from p.published_at) = ${year}
       and extract(month from p.published_at) = ${month}
  `);
  return Number(res.rows?.[0]?.c ?? 0);
}

export async function getPostCountByYear(year: number): Promise<number> {
  const res: any = await db.execute(sql`
    select count(*)::int as c
      from posts p
     where p.published_at is not null
       and extract(year from p.published_at) = ${year}
  `);
  return Number(res.rows?.[0]?.c ?? 0);
}
