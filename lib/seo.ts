// SPDX-License-Identifier: Apache-2.0
import { db } from "./db";
import { posts } from "../drizzle/schema";
import { desc, and, isNotNull, sql } from "drizzle-orm";
import { getArchiveMonths } from "./archives";

export interface SitemapUrl {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
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

/**
 * Generate URLs for sitemap
 */
export async function getSitemapUrls(): Promise<SitemapUrl[]> {
  const siteMetadata = getSiteMetadata();
  const baseUrl = siteMetadata.url;
  const urls: SitemapUrl[] = [];

  // Home page
  urls.push({
    url: baseUrl,
    changeFrequency: 'daily',
    priority: 1.0,
  });

  // Get all published posts
  const postRows = await db
    .select({
      slug: posts.slug,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(isNotNull(posts.publishedAt))
    .orderBy(desc(posts.publishedAt));

  // Add post URLs
  for (const post of postRows) {
    const lastModified = post.updatedAt || post.publishedAt;
    const url: SitemapUrl = {
      url: `${baseUrl}/${post.slug}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    };
    
    if (lastModified) {
      url.lastModified = lastModified;
    }
    
    urls.push(url);
  }

  // Get archive months and add archive URLs
  const archiveMonths = await getArchiveMonths();
  for (const month of archiveMonths) {
    const [year, monthStr] = month.slug.split('/');
    
    // Year archive
    urls.push({
      url: `${baseUrl}/archive/${year}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    });

    // Month archive
    urls.push({
      url: `${baseUrl}/archive/${year}/${monthStr}`,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  return urls;
}

/**
 * Generate sitemap XML
 */
export function generateSitemapXML(urls: SitemapUrl[]): string {
  const urlElements = urls.map(url => {
    let urlElement = `  <url>
    <loc>${url.url}</loc>`;
    
    if (url.lastModified) {
      urlElement += `
    <lastmod>${url.lastModified.toISOString()}</lastmod>`;
    }
    
    if (url.changeFrequency) {
      urlElement += `
    <changefreq>${url.changeFrequency}</changefreq>`;
    }
    
    if (url.priority !== undefined) {
      urlElement += `
    <priority>${url.priority.toFixed(1)}</priority>`;
    }
    
    urlElement += `
  </url>`;
    
    return urlElement;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
}

/**
 * Generate Open Graph meta tags for a post
 */
export function generatePostOpenGraph(post: {
  title: string;
  excerpt?: string | null;
  slug: string;
}): { [key: string]: string } {
  const siteMetadata = getSiteMetadata();
  const postUrl = `${siteMetadata.url}/${post.slug}`;
  
  return {
    'og:title': post.title,
    'og:description': post.excerpt || siteMetadata.description,
    'og:url': postUrl,
    'og:type': 'article',
    'og:site_name': siteMetadata.title,
    'twitter:card': 'summary_large_image',
    'twitter:title': post.title,
    'twitter:description': post.excerpt || siteMetadata.description,
  };
}

/**
 * Generate JSON-LD structured data for a post
 */
export function generatePostJsonLd(post: {
  title: string;
  excerpt?: string | null;
  slug: string;
  publishedAt?: string | null;
  html?: string;
}) {
  const siteMetadata = getSiteMetadata();
  const postUrl = `${siteMetadata.url}/${post.slug}`;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || siteMetadata.description,
    url: postUrl,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Organization',
      name: siteMetadata.title,
    },
    publisher: {
      '@type': 'Organization',
      name: siteMetadata.title,
    },
  };
}