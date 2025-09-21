# Banner & Archive Features (Slice I)

This document covers the Banner and Monthly Archive features implemented in Slice I.

## Banner Component

The banner component provides a responsive hero image that can be configured via the admin interface.

### Configuration

Banner settings are managed through the admin interface at `/admin/system/appearance`:

- **Enable/Disable**: Toggle banner visibility
- **Image URL**: URL to the banner image
- **Alt Text**: Accessibility text for the image
- **Credit**: Photo credit or attribution text
- **Overlay Opacity**: Dark overlay opacity (0-100%)
- **Focal Point**: X/Y position for image focal point (0-100%)

### Technical Details

- **Component**: `components/Banner.tsx`
- **Configuration Keys**: `APPEARANCE.BANNER.*` in the database
- **Responsive**: Uses `<picture>` element with multiple breakpoints
- **SEO**: Includes proper alt text and loading attributes

### Usage

The banner automatically appears on the home page when enabled. It reads configuration from the database on each request.

## Monthly Archives

The archive functionality provides browsable monthly and yearly post collections.

### Routes

- `/archive/[year]` - Posts for a specific year (e.g., `/archive/2024`)
- `/archive/[year]/[month]` - Posts for a specific month (e.g., `/archive/2024/03`)
- `/archive/[year]/[month]/feed.xml` - RSS feed for a specific month

### Features

- **Pagination**: Configurable page size for post lists
- **Validation**: Year and month parameter validation
- **Sidebar Navigation**: Automatic archive links in sidebar
- **RSS Feeds**: Monthly RSS feeds for archive periods
- **SEO**: Proper meta tags and structured data

### Technical Details

- **Library**: `lib/archives.ts` for data fetching
- **RSS**: `lib/rss.ts` for feed generation  
- **SEO**: `lib/seo.ts` for metadata and sitemap
- **Cache**: ISR with 1-hour revalidation
- **Configuration**: Uses `ARCHIVE.MONTHS-SIDEBAR` setting

### Sidebar Integration

The sidebar automatically shows up to 24 months of archives (configurable via `ARCHIVE.MONTHS-SIDEBAR`). Each archive link shows the month name and post count.

## Cache Strategy

Both features use Next.js ISR (Incremental Static Regeneration):

- **Banner**: Regenerated when appearance settings change
- **Archives**: 1-hour cache with tag-based revalidation
- **Revalidation**: Automatic cache invalidation when content changes

## SEO Integration

- **Sitemap**: Archive URLs included in `/sitemap.xml`
- **RSS**: Global feed at `/feed.xml` and monthly feeds
- **Meta Tags**: Proper Open Graph and Twitter Card tags
- **Canonical URLs**: Correct canonical links for all archive pages

## Configuration Keys

Required configuration keys (seeded by `pnpm seed:config`):

```
APPEARANCE.BANNER.ENABLED (boolean) = false
APPEARANCE.BANNER.IMAGE-URL (string) = ""
APPEARANCE.BANNER.ALT (string) = ""
APPEARANCE.BANNER.CREDIT (string) = ""
APPEARANCE.BANNER.OVERLAY (number 0..1) = 0.45
APPEARANCE.BANNER.FOCAL-X (number 0..1) = 0.5
APPEARANCE.BANNER.FOCAL-Y (number 0..1) = 0.5
ARCHIVE.MONTHS-SIDEBAR (integer) = 24
FEED.LATEST-COUNT (integer) = 20
```