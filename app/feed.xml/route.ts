// SPDX-License-Identifier: Apache-2.0
/**
 * Global RSS feed endpoint
 */

import { listPosts } from '@/lib/posts';
import { generateRSSXML, postToRSSItem, type RSSConfig } from '@/lib/rss';
import { ConfigServiceImpl } from '@/lib/config';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const config = new ConfigServiceImpl({ db });
    
    // Get feed count from configuration
    const feedCount = await config.getNumber('FEED.LATEST-COUNT');
    if (!feedCount) {
      throw new Error('Missing required config: FEED.LATEST-COUNT');
    }

    // Get latest posts
    const { items: posts } = await listPosts({ limit: feedCount });

    // Get base URL from environment or fallback
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Configure RSS feed
    const rssConfig: RSSConfig = {
      title: 'Narravo',
      description: 'A modern blog platform',
      link: baseUrl,
      language: 'en',
      managingEditor: 'editor@narravo.com',
      copyright: `© ${new Date().getFullYear()} Narravo`,
    };

    // Convert posts to RSS items
    const rssItems = posts.map(post => postToRSSItem(post, baseUrl));

    // Generate RSS XML
    const rssXML = generateRSSXML(rssConfig, rssItems);

    return new Response(rssXML, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}