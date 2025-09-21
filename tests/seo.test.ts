// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { 
  generatePostSEO,
  generateHomeSEO,
  postsToSitemapURLs,
  generateArchiveSitemapURLs,
  generateSitemapXML,
  formatSitemapDate,
  type SiteConfig 
} from '@/lib/seo';
import type { PostDTO } from '@/src/types/content';

describe('SEO utilities', () => {
  const siteConfig: SiteConfig = {
    title: 'Test Blog',
    description: 'A test blog for testing',
    url: 'https://example.com',
    logo: 'https://example.com/logo.png',
    twitterHandle: '@testblog',
  };

  const samplePost: PostDTO = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'sample-post',
    title: 'Sample Post Title',
    excerpt: 'This is a sample excerpt for the post',
    publishedAt: '2024-01-15T10:00:00Z',
    author: { name: 'John Doe' },
  };

  describe('generatePostSEO', () => {
    it('should generate correct SEO metadata for a post', () => {
      const seo = generatePostSEO(samplePost, siteConfig);

      expect(seo.title).toBe('Sample Post Title | Test Blog');
      expect(seo.description).toBe('This is a sample excerpt for the post');
      expect(seo.canonical).toBe('https://example.com/sample-post');
      expect(seo.ogTitle).toBe('Sample Post Title');
      expect(seo.ogDescription).toBe('This is a sample excerpt for the post');
      expect(seo.ogType).toBe('article');
      expect(seo.twitterCard).toBe('summary_large_image');
    });

    it('should generate JSON-LD structured data', () => {
      const seo = generatePostSEO(samplePost, siteConfig);

      expect(seo.jsonLd).toEqual({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Sample Post Title',
        description: 'This is a sample excerpt for the post',
        url: 'https://example.com/sample-post',
        datePublished: '2024-01-15T10:00:00Z',
        dateModified: '2024-01-15T10:00:00Z',
        author: {
          '@type': 'Person',
          name: 'John Doe',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Test Blog',
          url: 'https://example.com',
          logo: 'https://example.com/logo.png',
        },
      });
    });

    it('should handle post without excerpt', () => {
      const postWithoutExcerpt = { ...samplePost, excerpt: null };
      const seo = generatePostSEO(postWithoutExcerpt, siteConfig);

      expect(seo.description).toBe('Read Sample Post Title on Test Blog');
    });

    it('should handle post without author', () => {
      const postWithoutAuthor = { ...samplePost, author: null };
      const seo = generatePostSEO(postWithoutAuthor, siteConfig);

      expect(seo.jsonLd).toEqual(
        expect.objectContaining({
          author: undefined,
        })
      );
    });
  });

  describe('generateHomeSEO', () => {
    it('should generate correct SEO metadata for home page', () => {
      const seo = generateHomeSEO(siteConfig);

      expect(seo.title).toBe('Test Blog');
      expect(seo.description).toBe('A test blog for testing');
      expect(seo.canonical).toBe('https://example.com');
      expect(seo.ogTitle).toBe('Test Blog');
      expect(seo.ogDescription).toBe('A test blog for testing');
      expect(seo.ogType).toBe('website');
      expect(seo.twitterCard).toBe('summary');
    });
  });

  describe('postsToSitemapURLs', () => {
    it('should convert posts to sitemap URLs', () => {
      const posts: PostDTO[] = [
        samplePost,
        {
          id: '456',
          slug: 'another-post',
          title: 'Another Post',
          publishedAt: '2024-01-10T08:00:00Z',
        },
      ];

      const urls = postsToSitemapURLs(posts, 'https://example.com');

      expect(urls).toHaveLength(2);
      expect(urls[0]).toEqual({
        url: 'https://example.com/sample-post',
        lastmod: '2024-01-15T10:00:00Z',
        changefreq: 'weekly',
        priority: 0.7,
      });
      expect(urls[1]).toEqual({
        url: 'https://example.com/another-post',
        lastmod: '2024-01-10T08:00:00Z',
        changefreq: 'weekly',
        priority: 0.7,
      });
    });
  });

  describe('generateArchiveSitemapURLs', () => {
    it('should generate archive URLs for years and months', () => {
      const archives = [
        { year: 2024 },
        { year: 2024, month: 1 },
        { year: 2023, month: 12 },
      ];

      const urls = generateArchiveSitemapURLs(archives, 'https://example.com');

      expect(urls).toHaveLength(3);
      expect(urls[0]).toEqual({
        url: 'https://example.com/2024/',
        changefreq: 'monthly',
        priority: 0.5,
      });
      expect(urls[1]).toEqual({
        url: 'https://example.com/2024/01/',
        changefreq: 'monthly',
        priority: 0.5,
      });
      expect(urls[2]).toEqual({
        url: 'https://example.com/2023/12/',
        changefreq: 'monthly',
        priority: 0.5,
      });
    });
  });

  describe('generateSitemapXML', () => {
    it('should generate valid sitemap XML', () => {
      const urls = [
        {
          url: 'https://example.com/',
          changefreq: 'daily' as const,
          priority: 1.0,
        },
        {
          url: 'https://example.com/post-1',
          lastmod: '2024-01-15',
          changefreq: 'weekly' as const,
          priority: 0.7,
        },
      ];

      const xml = generateSitemapXML(urls);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('<loc>https://example.com/</loc>');
      expect(xml).toContain('<changefreq>daily</changefreq>');
      expect(xml).toContain('<priority>1</priority>');
      expect(xml).toContain('<loc>https://example.com/post-1</loc>');
      expect(xml).toContain('<lastmod>2024-01-15</lastmod>');
    });

    it('should escape XML characters in URLs', () => {
      const urls = [
        {
          url: 'https://example.com/post?param=value&other=data',
          changefreq: 'weekly' as const,
        },
      ];

      const xml = generateSitemapXML(urls);

      expect(xml).toContain('https://example.com/post?param=value&amp;other=data');
    });
  });

  describe('formatSitemapDate', () => {
    it('should format date to ISO date format', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const formatted = formatSitemapDate(date);

      expect(formatted).toBe('2024-01-15');
    });

    it('should handle string dates', () => {
      const formatted = formatSitemapDate('2024-01-15T10:00:00Z');

      expect(formatted).toBe('2024-01-15');
    });
  });
});