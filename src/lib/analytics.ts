// SPDX-License-Identifier: Apache-2.0
import { db } from "./db";
import { posts, postDailyViews, postViewEvents } from "@/drizzle/schema";
import { sql, eq, gte, desc, and, count, sum, inArray } from "drizzle-orm";
import { ConfigServiceImpl } from "./config";
import crypto from "crypto";

const config = new ConfigServiceImpl({ db });

interface RecordViewInput {
  postId: string;
  sessionId?: string;
  ip?: string;
  ua?: string;
  referer?: string;
  lang?: string;
}

interface PostDTO {
  id: string;
  slug: string;
  title: string;
  viewsLastNDays?: number;
  totalViews?: number;
}

interface ViewCounts {
  postId: string;
  totalViews: number;
  viewsLastNDays: number;
}

interface SparklineData {
  day: string; // YYYY-MM-DD
  views: number;
}

// Detect a missing relation/table error (e.g., post_daily_views not created yet)
function isMissingDailyViewsRelation(err: unknown): boolean {
  const e = err as any;
  if (!e) return false;
  if (e.code === "42P01") return true; // undefined_table
  const msg: string | undefined = e.message || e.cause?.message;
  return !!msg && /post_daily_views/.test(msg);
}

// Bot detection regex patterns
const BOT_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /slurp/i,
  /headless/i,
  /puppeteer/i,
  /selenium/i,
  /playwright/i,
  /httpclient/i,
];

function hashIp(ip: string): string | null {
  const salt = process.env.ANALYTICS_IP_SALT;
  if (!salt) return null;
  
  return crypto
    .createHmac("sha256", salt)
    .update(ip)
    .digest("hex");
}

function isBot(userAgent?: string, referer?: string): boolean {
  if (!userAgent) {
    // If no UA, treat as bot unless referer present (tunable)
    return !referer;
  }
  
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

function parseReferer(referer?: string): { host?: string; path?: string } {
  if (!referer) return {};
  
  try {
    const url = new URL(referer);
    return {
      host: url.hostname,
      path: url.pathname,
    };
  } catch {
    return {};
  }
}

function parseLang(acceptLanguage?: string): string | undefined {
  if (!acceptLanguage) return undefined;
  
  // Extract primary language from Accept-Language header
  const match = acceptLanguage.match(/^([a-z]{2}(?:-[A-Z]{2})?)/);
  return match?.[1];
}

export async function recordView(input: RecordViewInput): Promise<boolean> {
  const { postId, sessionId, ip, ua, referer, lang } = input;

  // Check if DNT should be respected
  const respectDnt = await config.getBoolean("VIEW.RESPECT-DNT");
  if (respectDnt && process.env.NODE_ENV !== "test") {
    // DNT check would be handled in the API route
  }

  // Check if bots should be counted
  const countBots = await config.getBoolean("VIEW.COUNT-BOTS");
  const botDetected = isBot(ua, referer);
  
  if (!countBots && botDetected) {
    return false; // Skip counting bots
  }

  // Get session window for deduplication
  const sessionWindowMinutes = await config.getNumber("VIEW.SESSION-WINDOW-MINUTES") ?? 30;
  const windowStart = new Date(Date.now() - sessionWindowMinutes * 60 * 1000);

  // Check for existing view in session window (session-scoped dedupe)
  if (sessionId) {
    const existingView = await db
      .select({ id: postViewEvents.id })
      .from(postViewEvents)
      .where(
        and(
          eq(postViewEvents.postId, postId),
          eq(postViewEvents.sessionId, sessionId),
          gte(postViewEvents.ts, windowStart)
        )
      )
      .limit(1);

    if (existingView.length > 0) {
      return false; // Skip duplicate view
    }
  }
  
  // If no sessionId, best-effort dedupe by IP hash within window
  if (!sessionId && ip) {
    const ipHashForDedupe = hashIp(ip);
    if (ipHashForDedupe) {
      const existingByIp = await db
        .select({ id: postViewEvents.id })
        .from(postViewEvents)
        .where(
          and(
            eq(postViewEvents.postId, postId),
            eq(postViewEvents.ipHash, ipHashForDedupe),
            gte(postViewEvents.ts, windowStart)
          )
        )
        .limit(1);
      if (existingByIp.length > 0) {
        return false;
      }
    }
  }

  const ipHash = ip ? hashIp(ip) : null;
  const refererParts = parseReferer(referer);
  const userLang = parseLang(lang);
  const currentDate = new Date().toISOString().split('T')[0];
  
  if (!currentDate) throw new Error("Invalid current date");

  try {
  await db.transaction(async (tx: any) => {
      // Insert view event
      await tx.insert(postViewEvents).values({
        postId,
        sessionId,
        ipHash,
        userAgent: ua,
        referrerHost: refererParts.host,
        referrerPath: refererParts.path,
        userLang,
        bot: botDetected,
      });

      // Update total views count
      await tx
        .update(posts)
        .set({ viewsTotal: sql`${posts.viewsTotal} + 1` })
        .where(eq(posts.id, postId));

      // Upsert daily views (if table exists). Swallow missing-table errors.
      try {
        // Determine if this is considered unique for the day
        let isUniqueForDay = false;
        if (sessionId) {
          const seen = await tx
            .select({ id: postViewEvents.id })
            .from(postViewEvents)
            .where(
              and(
                eq(postViewEvents.postId, postId),
                eq(postViewEvents.sessionId, sessionId),
                gte(postViewEvents.ts, new Date(`${currentDate}T00:00:00.000Z`))
              )
            )
            .limit(1);
          isUniqueForDay = seen.length === 0;
        } else if (ip) {
          const ipHashForDay = hashIp(ip);
          if (ipHashForDay) {
            const seen = await tx
              .select({ id: postViewEvents.id })
              .from(postViewEvents)
              .where(
                and(
                  eq(postViewEvents.postId, postId),
                  eq(postViewEvents.ipHash, ipHashForDay),
                  gte(postViewEvents.ts, new Date(`${currentDate}T00:00:00.000Z`))
                )
              )
              .limit(1);
            isUniqueForDay = seen.length === 0;
          }
        }

        await tx.execute(sql`
          INSERT INTO post_daily_views (day, post_id, views, uniques)
          VALUES (${currentDate}, ${postId}, 1, ${isUniqueForDay ? 1 : 0})
          ON CONFLICT (day, post_id)
          DO UPDATE SET
            views = post_daily_views.views + 1,
            uniques = post_daily_views.uniques + ${isUniqueForDay ? 1 : 0}
        `);
      } catch (err) {
        if (!isMissingDailyViewsRelation(err)) throw err;
        // If the table is missing, we simply skip daily aggregation.
      }
    });

    return true;
  } catch (error) {
    console.error("Failed to record view:", error);
    return false;
  }
}

export async function getTrendingPosts({ days = 7, limit = 10 }: { days?: number; limit?: number }): Promise<PostDTO[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr: string = startDate.toISOString().slice(0, 10);
  
  if (!startDateStr) throw new Error("Invalid start date");

  try {
    const trendingPosts = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        totalViews: posts.viewsTotal,
        viewsLastNDays: sum(postDailyViews.views),
      })
      .from(posts)
      .leftJoin(postDailyViews, eq(posts.id, postDailyViews.postId))
      .where(
        and(
          gte(postDailyViews.day, startDateStr),
          // Only include published posts
          sql`${posts.publishedAt} IS NOT NULL AND ${posts.publishedAt} <= NOW()`
        )
      )
      .groupBy(posts.id, posts.slug, posts.title, posts.viewsTotal)
      .orderBy(desc(sum(postDailyViews.views)))
      .limit(limit);

  return trendingPosts.map((post: any) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      totalViews: post.totalViews,
      viewsLastNDays: Number(post.viewsLastNDays) || 0,
    }));
  } catch (err) {
    if (!isMissingDailyViewsRelation(err)) throw err;
    // Fallback: if daily views table is missing, approximate trending by total views
    const rows = await db
      .select({ id: posts.id, slug: posts.slug, title: posts.title, totalViews: posts.viewsTotal })
      .from(posts)
      .where(sql`${posts.publishedAt} IS NOT NULL AND ${posts.publishedAt} <= NOW()`)
      .orderBy(desc(posts.viewsTotal))
      .limit(limit);

  return rows.map((r: any) => ({ id: r.id, slug: r.slug, title: r.title, totalViews: r.totalViews, viewsLastNDays: 0 }));
  }
}

export async function getPostViewCounts(postIds: string[]): Promise<Map<string, ViewCounts>> {
  if (postIds.length === 0) return new Map();

  const trendingDays = await config.getNumber("VIEW.TRENDING-DAYS") ?? 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - trendingDays);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  if (!startDateStr) throw new Error("Invalid start date");

  try {
    const results = await db
      .select({
        postId: posts.id,
        totalViews: posts.viewsTotal,
        recentViews: sum(postDailyViews.views),
      })
      .from(posts)
      .leftJoin(
        postDailyViews,
        and(
          eq(posts.id, postDailyViews.postId),
          gte(postDailyViews.day, startDateStr)
        )
      )
      .where(inArray(posts.id, postIds))
      .groupBy(posts.id, posts.viewsTotal);

    const viewCounts = new Map<string, ViewCounts>();

    for (const result of results) {
      viewCounts.set(result.postId, {
        postId: result.postId,
        totalViews: result.totalViews,
        viewsLastNDays: Number(result.recentViews) || 0,
      });
    }

    return viewCounts;
  } catch (err) {
    if (!isMissingDailyViewsRelation(err)) throw err;
    // Fallback: no daily table, return totalViews and zeros for recent
    const rows = await db
      .select({ postId: posts.id, totalViews: posts.viewsTotal })
      .from(posts)
      .where(inArray(posts.id, postIds));

    const viewCounts = new Map<string, ViewCounts>();
    for (const r of rows) {
      viewCounts.set(r.postId, { postId: r.postId, totalViews: r.totalViews, viewsLastNDays: 0 });
    }
    return viewCounts;
  }
}

export async function getPostSparkline(postId: string, days: number = 30): Promise<SparklineData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  
  const sparklineData: SparklineData[] = [];
  
  // Generate all days in range
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayStr = date.toISOString().split('T')[0];
    if (dayStr) {
      sparklineData.push({
        day: dayStr,
        views: 0,
      });
    }
  }

  // Get actual view data
  const startDateStr = startDate.toISOString().split('T')[0];
  if (!startDateStr) throw new Error("Invalid start date");
  
  try {
    const viewData = await db
      .select({
        day: postDailyViews.day,
        views: postDailyViews.views,
      })
      .from(postDailyViews)
      .where(
        and(
          eq(postDailyViews.postId, postId),
          gte(postDailyViews.day, startDateStr)
        )
      )
      .orderBy(postDailyViews.day);

    // Merge actual data with the template
  const dataMap = new Map<string, number>(viewData.map((item: any) => [item.day as string, Number(item.views)]));

    return sparklineData.map((item: SparklineData) => ({
      ...item,
      views: dataMap.get(item.day) ?? 0,
    }));
  } catch (err) {
    if (!isMissingDailyViewsRelation(err)) throw err;
    // Fallback: table missing, return zeros
    return sparklineData;
  }
}

// Test helpers
export const __testHelpers__ = {
  isBot,
  hashIp,
  parseReferer,
  parseLang,
};

// Dashboard summary: totals and top posts
export async function getSiteAnalyticsSummary({ days = 7, topN = 5 }: { days?: number; topN?: number }) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Total views all time
  const totalRows = await db
    .select({ total: sum(posts.viewsTotal) })
    .from(posts)
    .where(sql`${posts.publishedAt} IS NOT NULL AND ${posts.publishedAt} <= NOW()`);
  const totalViewsAllTime = Number(totalRows[0]?.total || 0);

  // Recent views in last N days (sum of daily views)
  let viewsLastNDays = 0;
  try {
    const recentRows = await db
      .select({ total: sum(postDailyViews.views) })
      .from(postDailyViews)
      .where(sql`${postDailyViews.day} >= ${startDateStr}`);
    viewsLastNDays = Number(recentRows[0]?.total || 0);
  } catch (err) {
    if (!isMissingDailyViewsRelation(err)) throw err;
    viewsLastNDays = 0;
  }

  // Top posts by last N days
  let topPosts: PostDTO[] = [];
  try {
    const rows = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        totalViews: posts.viewsTotal,
        recent: sum(postDailyViews.views),
      })
      .from(posts)
      .leftJoin(postDailyViews, eq(posts.id, postDailyViews.postId))
      .where(
        and(
          sql`${postDailyViews.day} >= ${startDateStr}`,
          sql`${posts.publishedAt} IS NOT NULL AND ${posts.publishedAt} <= NOW()`
        )
      )
      .groupBy(posts.id, posts.slug, posts.title, posts.viewsTotal)
      .orderBy(desc(sum(postDailyViews.views)))
      .limit(topN);

    topPosts = rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      totalViews: r.totalViews,
      viewsLastNDays: Number(r.recent) || 0,
    }));
  } catch (err) {
    if (!isMissingDailyViewsRelation(err)) throw err;
    // Fallback to top by total views
    const rows = await db
      .select({ id: posts.id, slug: posts.slug, title: posts.title, totalViews: posts.viewsTotal })
      .from(posts)
      .where(sql`${posts.publishedAt} IS NOT NULL AND ${posts.publishedAt} <= NOW()`)
      .orderBy(desc(posts.viewsTotal))
      .limit(topN);
  topPosts = rows.map((r: any) => ({ id: r.id, slug: r.slug, title: r.title, totalViews: r.totalViews, viewsLastNDays: 0 }));
  }

  return { totalViewsAllTime, viewsLastNDays, topPosts };
}