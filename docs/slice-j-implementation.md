# Slice J - SEO, Feeds & Redirects Implementation

This document describes the implementation of Slice J from the Narravo PRD, which provides SEO optimization, RSS feeds, and redirects functionality.

## Features Implemented

### 1. Global RSS Feed (`/feed.xml`)
- **Route**: `/feed.xml`
- **Description**: Generates an RSS feed with the latest posts
- **Configuration**: Uses `FEED.LATEST-COUNT` config setting (default: 20)
- **Format**: RSS 2.0 with proper XML structure
- **Caching**: 1 hour cache with stale-while-revalidate

### 2. Site-wide Sitemap (`/sitemap.xml`)
- **Route**: `/sitemap.xml`
- **Description**: Generates XML sitemap including posts and archive pages
- **Includes**:
  - Home page (priority 1.0)
  - All published posts (priority 0.7)
  - Year and month archive pages (priority 0.5)
  - RSS feed itself
- **Format**: XML Sitemap 0.9 protocol
- **Caching**: 1 hour cache with stale-while-revalidate

### 3. Per-Post SEO Metadata
- **Description**: Adds comprehensive SEO metadata to post pages
- **Includes**:
  - Title and description optimization
  - Open Graph tags for social sharing
  - Twitter Card metadata
  - JSON-LD structured data for search engines
  - Canonical URLs

### 4. Redirects Middleware
- **Description**: Handles legacy URL redirects using database-stored redirects
- **Features**:
  - 301/302 status code support
  - Database-driven redirect mapping
  - Automatic middleware processing
  - Error handling

## File Structure

```
app/
├── feed.xml/route.ts          # RSS feed endpoint
├── sitemap.xml/route.ts       # Sitemap endpoint
└── (public)/[slug]/page.tsx   # Updated with SEO metadata

lib/
├── rss.ts                     # RSS generation utilities
├── seo.ts                     # SEO helpers and sitemap generation
└── redirects.ts               # Redirect data access

middleware.ts                  # Redirects middleware

tests/
├── rss.test.ts               # RSS functionality tests
├── seo.test.ts               # SEO utilities tests
└── redirects.test.ts         # Redirects functionality tests
```

## Configuration

The implementation uses the Narravo configuration service:

- **FEED.LATEST-COUNT** (integer, default: 20): Number of posts to include in the global RSS feed

## Usage

### RSS Feed
Visit `https://yoursite.com/feed.xml` to access the RSS feed.

### Sitemap
Visit `https://yoursite.com/sitemap.xml` to access the sitemap.

### Redirects
Add redirects to the database using the `redirects` table:

```sql
INSERT INTO redirects (from_path, to_path, status) 
VALUES ('/old-url', '/new-url', 301);
```

### SEO Metadata
SEO metadata is automatically generated for all post pages using the post's title, excerpt, and other data.

## API Reference

### RSS Utilities (`lib/rss.ts`)
- `postToRSSItem(post, baseUrl)`: Convert post to RSS item
- `generateRSSXML(config, items)`: Generate complete RSS XML
- `formatRSSDate(date)`: Format date for RSS

### SEO Utilities (`lib/seo.ts`)
- `generatePostSEO(post, siteConfig)`: Generate SEO metadata for posts
- `generateHomeSEO(siteConfig)`: Generate SEO metadata for home page
- `postsToSitemapURLs(posts, baseUrl)`: Convert posts to sitemap URLs
- `generateSitemapXML(urls)`: Generate sitemap XML

### Redirects (`lib/redirects.ts`)
- `findRedirect(fromPath)`: Find redirect for a path
- `createRedirect(fromPath, toPath, status)`: Create new redirect
- `getAllRedirects()`: Get all redirects

## Testing

All functionality is covered by unit tests:

```bash
pnpm test -- tests/rss.test.ts tests/seo.test.ts tests/redirects.test.ts
```

## Notes

- The middleware uses Node.js runtime (not Edge) due to database access
- Base URLs are derived from the `NEXTAUTH_URL` environment variable
- Error handling is implemented for all database operations
- The implementation follows Next.js 14 App Router patterns