// SPDX-License-Identifier: Apache-2.0
import { getPostsForRSS, generateRSSXML, getSiteMetadata } from "@/lib/rss";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

// Revalidate the feed every hour
export const revalidate = 3600;

export async function GET() {
  const config = new ConfigServiceImpl({ db });
  const latestCount = await config.getNumber("FEED.LATEST-COUNT");

  if (latestCount == null) {
    console.error("Missing required config: FEED.LATEST-COUNT");
    return new Response("Internal Server Error: Missing configuration.", {
      status: 500,
    });
  }

  const posts = await getPostsForRSS(latestCount);
  const siteMetadata = getSiteMetadata();

  const feedData = {
    ...siteMetadata,
    posts,
    link: siteMetadata.url,
    lastBuildDate: posts.length > 0 && posts[0] ? new Date(posts[0].publishedAt) : new Date(),
  };

  const xml = generateRSSXML(feedData);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=1800`,
    },
  });
}
