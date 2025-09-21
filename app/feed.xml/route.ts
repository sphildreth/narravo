// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { getPostsForRSS, generateRSSXML, getSiteMetadata } from "@/lib/rss";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const config = new ConfigServiceImpl({ db });
    const feedCount = (await config.getNumber("FEED.LATEST-COUNT")) ?? 20;
    
    const posts = await getPostsForRSS(feedCount);
    const siteMetadata = getSiteMetadata();
    
    const rssXML = generateRSSXML({
      title: siteMetadata.title,
      description: siteMetadata.description,
      link: siteMetadata.url,
      posts,
      lastBuildDate: new Date(),
    });

    return new Response(rssXML, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Enable ISR
export const revalidate = 3600; // 1 hour