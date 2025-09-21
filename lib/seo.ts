// SPDX-License-Identifier: Apache-2.0
/**
 * SEO utilities for meta tags, JSON-LD, and sitemap generation
 */

import type { PostDTO } from "@/src/types/content";

export interface SiteConfig {
  title: string;
  description: string;
  url: string;
  logo?: string;
  twitterHandle?: string;
}

export interface PageSEO {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: object;
}

/**
 * Generate SEO metadata for a post
 */
export function generatePostSEO(post: PostDTO, siteConfig: SiteConfig): PageSEO {
  const canonical = `${siteConfig.url}/${post.slug}`;
  const description = post.excerpt || `Read ${post.title} on ${siteConfig.title}`;
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": description,
    "url": canonical,
    "datePublished": post.publishedAt,
    "dateModified": post.publishedAt, // Using publishedAt as a fallback
    "author": post.author?.name ? {
      "@type": "Person",
      "name": post.author.name,
    } : undefined,
    "publisher": {
      "@type": "Organization",
      "name": siteConfig.title,
      "url": siteConfig.url,
      ...(siteConfig.logo && { "logo": siteConfig.logo }),
    },
  };

  return {
    title: `${post.title} | ${siteConfig.title}`,
    description,
    canonical,
    ogTitle: post.title,
    ogDescription: description,
    ogType: 'article',
    twitterCard: 'summary_large_image',
    jsonLd,
  };
}

/**
 * Generate SEO metadata for the home page
 */
export function generateHomeSEO(siteConfig: SiteConfig): PageSEO {
  return {
    title: siteConfig.title,
    description: siteConfig.description,
    canonical: siteConfig.url,
    ogTitle: siteConfig.title,
    ogDescription: siteConfig.description,
    ogType: 'website',
    twitterCard: 'summary',
  };
}

/**
 * Generate sitemap URL entries
 */
export interface SitemapURL {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Convert posts to sitemap URLs
 */
export function postsToSitemapURLs(posts: PostDTO[], baseUrl: string): SitemapURL[] {
  return posts.map(post => {
    const url: SitemapURL = {
      url: `${baseUrl}/${post.slug}`,
      changefreq: 'weekly' as const,
      priority: 0.7,
    };

    if (post.publishedAt) {
      url.lastmod = post.publishedAt;
    }

    return url;
  });
}

/**
 * Generate archive sitemap URLs for given years/months
 */
export function generateArchiveSitemapURLs(
  archives: Array<{ year: number; month?: number }>,
  baseUrl: string
): SitemapURL[] {
  return archives.map(archive => ({
    url: archive.month
      ? `${baseUrl}/${archive.year}/${archive.month.toString().padStart(2, '0')}/`
      : `${baseUrl}/${archive.year}/`,
    changefreq: 'monthly' as const,
    priority: 0.5,
  }));
}

/**
 * Generate sitemap XML
 */
export function generateSitemapXML(urls: SitemapURL[]): string {
  const urlEntries = urls
    .map(url => `
  <url>
    <loc>${escapeXML(url.url)}</loc>
    ${url.lastmod ? `<lastmod>${formatSitemapDate(url.lastmod)}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
  </url>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlEntries}
</urlset>`;
}

/**
 * Format date for sitemap (ISO 8601)
 */
export function formatSitemapDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const isoString = d.toISOString();
  const datePart = isoString.split('T')[0];
  return datePart!; // YYYY-MM-DD format
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}