// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { getSitemapUrls, generateSitemapXML } from "@/lib/seo";

export async function GET(request: NextRequest) {
  try {
    const urls = await getSitemapUrls();
    const sitemapXML = generateSitemapXML(urls);

    return new Response(sitemapXML, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Enable ISR
export const revalidate = 3600; // 1 hour