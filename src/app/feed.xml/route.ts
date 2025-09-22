// SPDX-License-Identifier: Apache-2.0
import { getPostsForRSS, generateRSSXML, getSiteMetadata } from "@/lib/rss";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

// Revalidate the feed every hour
export const revalidate = 3600;

export async function GET() {
  // Best-effort: allow build to succeed even if DB/config are unavailable
  let latestCount = 20;
  try {
    const config = new ConfigServiceImpl({ db });
    const c = await config.getNumber("FEED.LATEST-COUNT");
    if (c != null) latestCount = c;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('feed.xml: falling back to default FEED.LATEST-COUNT due to config/db error');
    }
  }

  let posts: Awaited<ReturnType<typeof getPostsForRSS>> = [];
  try {
    posts = await getPostsForRSS(latestCount);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('feed.xml: failed to load posts; returning empty feed');
    }
    posts = [];
  }

  const siteMetadata = getSiteMetadata();

  const firstPublished = posts.find((p) => !!p.publishedAt)?.publishedAt ?? null;
  const lastBuildDate = firstPublished ? new Date(firstPublished) : new Date();

  const feedData = {
    ...siteMetadata,
    posts,
    link: siteMetadata.url,
    lastBuildDate,
  };

  const xml = generateRSSXML(feedData);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=1800`,
    },
  });
}
