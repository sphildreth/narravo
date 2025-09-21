// SPDX-License-Identifier: Apache-2.0
import { db } from "./db";
import { posts } from "../drizzle/schema";
import { sql, desc, asc, and, gte, lt, count, isNotNull } from "drizzle-orm";
import { ConfigServiceImpl } from "./config";

export interface ArchiveMonth {
  year: number;
  month: number;
  count: number;
  label: string; // e.g., "March 2024"
  slug: string; // e.g., "2024/03"
}

export interface ArchivePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Get list of months with post counts for archive sidebar
 */
export async function getArchiveMonths(): Promise<ArchiveMonth[]> {
  const config = new ConfigServiceImpl({ db });
  const maxMonths = (await config.getNumber("ARCHIVE.MONTHS-SIDEBAR")) ?? 24;
  
  // Get published posts grouped by year and month
  const result = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${posts.publishedAt})`.as("year"),
      month: sql<number>`EXTRACT(MONTH FROM ${posts.publishedAt})`.as("month"),
      count: count(posts.id).as("count"),
    })
    .from(posts)
    .where(isNotNull(posts.publishedAt))
    .groupBy(
      sql`EXTRACT(YEAR FROM ${posts.publishedAt})`,
      sql`EXTRACT(MONTH FROM ${posts.publishedAt})`
    )
    .orderBy(
      desc(sql`EXTRACT(YEAR FROM ${posts.publishedAt})`),
      desc(sql`EXTRACT(MONTH FROM ${posts.publishedAt})`)
    )
    .limit(maxMonths);

  return result.map(({ year, month, count }) => ({
    year,
    month,
    count,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    slug: `${year}/${month.toString().padStart(2, '0')}`,
  }));
}

/**
 * Get posts for a specific year
 */
export async function getPostsByYear(year: number, page = 1, pageSize = 10): Promise<{
  posts: ArchivePost[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}> {
  const offset = (page - 1) * pageSize;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  // Get total count
  const totalCountResult = await db
    .select({ count: count(posts.id) })
    .from(posts)
    .where(
      and(
        isNotNull(posts.publishedAt),
        gte(posts.publishedAt, yearStart),
        lt(posts.publishedAt, yearEnd)
      )
    );
  
  const totalCount = totalCountResult[0]?.count ?? 0;

  // Get posts for page
  const result = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(
      and(
        isNotNull(posts.publishedAt),
        gte(posts.publishedAt, yearStart),
        lt(posts.publishedAt, yearEnd)
      )
    )
    .orderBy(desc(posts.publishedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    posts: result as ArchivePost[],
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}

/**
 * Get posts for a specific month
 */
export async function getPostsByMonth(year: number, month: number, page = 1, pageSize = 10): Promise<{
  posts: ArchivePost[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  monthLabel: string;
}> {
  const offset = (page - 1) * pageSize;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  // Get total count
  const totalCountResult = await db
    .select({ count: count(posts.id) })
    .from(posts)
    .where(
      and(
        isNotNull(posts.publishedAt),
        gte(posts.publishedAt, monthStart),
        lt(posts.publishedAt, monthEnd)
      )
    );

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Get posts for page
  const result = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(
      and(
        isNotNull(posts.publishedAt),
        gte(posts.publishedAt, monthStart),
        lt(posts.publishedAt, monthEnd)
      )
    )
    .orderBy(desc(posts.publishedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    posts: result as ArchivePost[],
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
    monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

/**
 * Validate year and month parameters
 */
export function validateArchiveParams(year: string, month?: string): {
  isValid: boolean;
  yearNum?: number;
  monthNum?: number;
  error?: string;
} {
  const yearNum = parseInt(year, 10);
  
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > new Date().getFullYear() + 1) {
    return { isValid: false, error: "Invalid year" };
  }

  if (month !== undefined) {
    const monthNum = parseInt(month, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return { isValid: false, error: "Invalid month" };
    }
    return { isValid: true, yearNum, monthNum };
  }

  return { isValid: true, yearNum };
}

/**
 * Generate archive cache tag for revalidation
 */
export function getArchiveCacheTag(year: number, month?: number): string {
  if (month !== undefined) {
    return `archive:${year}-${month.toString().padStart(2, '0')}`;
  }
  return `archive:${year}`;
}