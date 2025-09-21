// SPDX-License-Identifier: Apache-2.0
/**
 * Sitemap XML endpoint
 */

import { getAllPublishedPosts, getArchiveMonths } from '@/lib/posts';
import { 
  generateSitemapXML, 
  postsToSitemapURLs, 
  generateArchiveSitemapURLs,
  type SitemapURL 
} from '@/lib/seo';

export async function GET() {
  try {
    // Get base URL from environment or fallback
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Collect all URLs for sitemap
    const urls: SitemapURL[] = [];

    // Add home page
    urls.push({
      url: baseUrl,
      changefreq: 'daily',
      priority: 1.0,
    });

    // Add all published posts
    const posts = await getAllPublishedPosts();
    urls.push(...postsToSitemapURLs(posts, baseUrl));

    // Add archive pages (years and months)
    const archiveMonths = await getArchiveMonths();
    
    // Get unique years
    const years = Array.from(new Set(archiveMonths.map(a => a.year)));
    const yearArchives = years.map(year => ({ year }));
    
    // Convert months to year/month format
    const monthArchives = archiveMonths.map(a => ({ year: a.year, month: a.month }));
    
    urls.push(...generateArchiveSitemapURLs(yearArchives, baseUrl));
    urls.push(...generateArchiveSitemapURLs(monthArchives, baseUrl));

    // Add RSS feed
    urls.push({
      url: `${baseUrl}/feed.xml`,
      changefreq: 'daily',
      priority: 0.5,
    });

    // Generate sitemap XML
    const sitemapXML = generateSitemapXML(urls);

    return new Response(sitemapXML, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}