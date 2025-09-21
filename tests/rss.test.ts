// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { 
  postToRSSItem, 
  generateRSSXML, 
  formatRSSDate,
  type RSSConfig,
  type RSSItem 
} from '@/lib/rss';
import type { PostDTO } from '@/src/types/content';

describe('RSS utilities', () => {
  const samplePost: PostDTO = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'sample-post',
    title: 'Sample Post Title',
    excerpt: 'This is a sample excerpt',
    publishedAt: '2024-01-15T10:00:00Z',
    author: { name: 'John Doe' },
  };

  const baseUrl = 'https://example.com';

  describe('postToRSSItem', () => {
    it('should convert a post to RSS item correctly', () => {
      const rssItem = postToRSSItem(samplePost, baseUrl);

      expect(rssItem.title).toBe('Sample Post Title');
      expect(rssItem.description).toBe('This is a sample excerpt');
      expect(rssItem.link).toBe('https://example.com/sample-post');
      expect(rssItem.guid).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(rssItem.author).toBe('John Doe');
      expect(rssItem.pubDate).toBeInstanceOf(Date);
    });

    it('should handle post without excerpt', () => {
      const postWithoutExcerpt = { ...samplePost, excerpt: null };
      const rssItem = postToRSSItem(postWithoutExcerpt, baseUrl);

      expect(rssItem.description).toBe('Sample Post Title');
    });

    it('should handle post without author', () => {
      const postWithoutAuthor = { ...samplePost, author: null };
      const rssItem = postToRSSItem(postWithoutAuthor, baseUrl);

      expect(rssItem.author).toBeUndefined();
    });
  });

  describe('generateRSSXML', () => {
    it('should generate valid RSS XML', () => {
      const config: RSSConfig = {
        title: 'Test Blog',
        description: 'A test blog',
        link: 'https://example.com',
        language: 'en',
      };

      const items: RSSItem[] = [
        {
          title: 'First Post',
          description: 'First post description',
          link: 'https://example.com/first-post',
          pubDate: new Date('2024-01-15T10:00:00Z'),
          guid: 'first-post-id',
        },
      ];

      const xml = generateRSSXML(config, items);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain('<title><![CDATA[Test Blog]]></title>');
      expect(xml).toContain('<description><![CDATA[A test blog]]></description>');
      expect(xml).toContain('<title><![CDATA[First Post]]></title>');
      expect(xml).toContain('<link>https://example.com/first-post</link>');
    });

    it('should escape XML in links', () => {
      const config: RSSConfig = {
        title: 'Test Blog',
        description: 'A test blog',
        link: 'https://example.com',
      };

      const items: RSSItem[] = [
        {
          title: 'Post with & ampersand',
          description: 'Description with <tags>',
          link: 'https://example.com/post?param=value&other=data',
          pubDate: new Date('2024-01-15T10:00:00Z'),
          guid: 'post-id',
        },
      ];

      const xml = generateRSSXML(config, items);

      expect(xml).toContain('https://example.com/post?param=value&amp;other=data');
      expect(xml).toContain('<![CDATA[Post with & ampersand]]>');
      expect(xml).toContain('<![CDATA[Description with <tags>]]>');
    });
  });

  describe('formatRSSDate', () => {
    it('should format date to RFC 822 format', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const formatted = formatRSSDate(date);

      expect(formatted).toBe('Mon, 15 Jan 2024 10:00:00 GMT');
    });

    it('should handle string dates', () => {
      const formatted = formatRSSDate('2024-01-15T10:00:00Z');

      expect(formatted).toBe('Mon, 15 Jan 2024 10:00:00 GMT');
    });
  });
});