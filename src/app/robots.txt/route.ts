// SPDX-License-Identifier: Apache-2.0
import { getSiteMetadata } from "@/lib/rss";

// Revalidate robots.txt every day (24 hours)
export const revalidate = 86400;

export async function GET() {
  const { url: siteUrl } = getSiteMetadata();

  if (!siteUrl) {
    return new Response("Internal Server Error: SITE_URL is not configured.", {
      status: 500,
    });
  }

  // Generate robots.txt content
  const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml

# Common crawl delays for politeness
Crawl-delay: 1

# Disallow admin and API routes from indexing
Disallow: /admin/
Disallow: /api/
Disallow: /_next/
Disallow: /healthz

# Allow RSS feeds
Allow: /feed.xml
Allow: /rss-feed/
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=3600`,
    },
  });
}