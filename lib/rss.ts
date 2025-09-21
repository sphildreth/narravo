// SPDX-License-Identifier: Apache-2.0
/**
 * RSS feed generation utilities
 */

import type { PostDTO } from "@/src/types/content";

export interface RSSConfig {
  title: string;
  description: string;
  link: string;
  language?: string;
  copyright?: string;
  managingEditor?: string;
}

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: Date;
  guid: string;
  author?: string;
}

/**
 * Convert a PostDTO to an RSS item
 */
export function postToRSSItem(post: PostDTO, baseUrl: string): RSSItem {
  const link = `${baseUrl}/${post.slug}`;
  const pubDate = post.publishedAt ? new Date(post.publishedAt) : new Date();
  
  const item: RSSItem = {
    title: post.title,
    description: post.excerpt || post.title,
    link,
    pubDate,
    guid: post.id,
  };

  if (post.author?.name) {
    item.author = post.author.name;
  }

  return item;
}

/**
 * Generate RSS XML from config and items
 */
export function generateRSSXML(config: RSSConfig, items: RSSItem[]): string {
  const now = new Date().toUTCString();
  
  const itemsXML = items
    .map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <description><![CDATA[${item.description}]]></description>
      <link>${escapeXML(item.link)}</link>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <guid isPermaLink="true">${escapeXML(item.link)}</guid>
      ${item.author ? `<author>${escapeXML(item.author)}</author>` : ''}
    </item>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${config.title}]]></title>
    <description><![CDATA[${config.description}]]></description>
    <link>${escapeXML(config.link)}</link>
    <atom:link href="${escapeXML(config.link)}/feed.xml" rel="self" type="application/rss+xml" />
    <language>${config.language || 'en'}</language>
    <lastBuildDate>${now}</lastBuildDate>
    ${config.managingEditor ? `<managingEditor>${escapeXML(config.managingEditor)}</managingEditor>` : ''}
    ${config.copyright ? `<copyright><![CDATA[${config.copyright}]]></copyright>` : ''}
    ${itemsXML}
  </channel>
</rss>`;
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

/**
 * Format date for RSS (RFC 822)
 */
export function formatRSSDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toUTCString();
}