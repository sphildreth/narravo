// SPDX-License-Identifier: Apache-2.0
import { db } from "./db";
import { posts } from "../drizzle/schema";
import { desc, and, isNotNull, gte, lt } from "drizzle-orm";

export interface RSSPost {
  id: string;
  slug: string;
  title: string;
  html: string;
  excerpt: string | null;
  publishedAt: Date;
  guid: string | null;
}

export interface RSSFeedData {
  title: string;
  description: string;
  link: string;
  posts: RSSPost[];
  lastBuildDate: Date;
}

/**
 * Get posts for RSS feed
 */
export async function getPostsForRSS(limit = 20): Promise<RSSPost[]> {
  const result = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      html: posts.html,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      guid: posts.guid,
    })
    .from(posts)
    .where(isNotNull(posts.publishedAt))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);

  return result.filter(post => post.publishedAt !== null) as RSSPost[];
}

/**
 * Get posts for monthly RSS feed
 */
export async function getMonthlyPostsForRSS(year: number, month: number): Promise<RSSPost[]> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const result = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      html: posts.html,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      guid: posts.guid,
    })
    .from(posts)
    .where(
      and(
        isNotNull(posts.publishedAt),
        gte(posts.publishedAt, monthStart),
        lt(posts.publishedAt, monthEnd)
      )
    )
    .orderBy(desc(posts.publishedAt));

  return result.filter(post => post.publishedAt !== null) as RSSPost[];
}

/**
 * Generate RSS XML
 */
export function generateRSSXML(feedData: RSSFeedData): string {
  const { title, description, link, posts, lastBuildDate } = feedData;
  
  const rssItems = posts.map(post => {
    const postUrl = `${link}/${post.slug}`;
    const pubDate = post.publishedAt.toUTCString();
    const guid = post.guid || post.id;
    
    // Escape XML content
    const escapeXML = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    return `    <item>
      <title>${escapeXML(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="false">${escapeXML(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt || ''}]]></description>
      <content:encoded><![CDATA[${post.html}]]></content:encoded>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <description>${description}</description>
    <link>${link}</link>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <language>en-US</language>
    <atom:link href="${link}/feed.xml" rel="self" type="application/rss+xml" />
    <generator>Narravo</generator>
${rssItems}
  </channel>
</rss>`;
}

/**
 * Get site metadata from environment or defaults
 */
export function getSiteMetadata() {
  return {
    title: process.env.SITE_TITLE || "Narravo Blog",
    description: process.env.SITE_DESCRIPTION || "A modern blog platform",
    url: process.env.SITE_URL || "https://localhost:3000",
  };
}