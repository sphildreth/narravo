// SPDX-License-Identifier: Apache-2.0
import { generateSitemap } from "@/lib/seo";
import { getSiteMetadata } from "@/lib/rss";

// Revalidate the sitemap every hour
export const revalidate = 3600;

export async function GET() {
  const { url: siteUrl } = getSiteMetadata();

  if (!siteUrl) {
    return new Response("Internal Server Error: SITE_URL is not configured.", {
      status: 500,
    });
  }

  const sitemap = await generateSitemap(siteUrl);

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=1800`,
    },
  });
}
