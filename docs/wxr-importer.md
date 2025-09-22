<!-- SPDX-License-Identifier: Apache-2.0 -->
# WXR Importer Documentation (Admin-only MVP)

The WXR (WordPress eXtended RSS) Importer allows importing WordPress exports into Narravo via the Admin portal only. The command-line runner is not part of MVP.

## Features

- **Idempotent imports**: Uses WordPress GUID for deduplication
- **Media downloads**: Downloads and uploads media to S3/R2 with SHA256 deduplication
- **URL rewriting**: Updates image/video URLs in post content
- **Redirects**: Creates 301 redirects from original WordPress URLs
- **Progress reporting**: Saves checkpoint files with import statistics
- **Sanitization**: Cleans HTML content using server-side sanitization
- **Featured image**: Stores featured image URL/alt when present in WXR metadata

## Import Process (Admin)

1. **Parse WXR file**: Extracts posts and attachments from WordPress export
2. **Filter content**: Only imports published posts, skips drafts and non-post types
3. **Generate slugs**: Creates URL-safe slugs with collision detection
4. **Download media**: Fetches attachments and uploads to configured S3/R2 (if enabled)
5. **Rewrite URLs**: Updates post content to use new media URLs
6. **Create redirects**: Maps old WordPress URLs to new post URLs
7. **Save checkpoint**: Records import statistics and errors (Admin persists summary)

## Storage Behavior

- The importer stores sanitized WordPress HTML into `posts.body_html` and mirrors it into the legacy `posts.html` column for backward compatibility.
- Because WXR exports HTML and not Markdown, `posts.body_md` is set to `NULL` on initial import.
- Re-imports (same GUID) will update title, excerpt, published date, `body_html`, and legacy `html`, but will not overwrite `body_md` if you later add Markdown manually.
- Featured image fields are stored in `posts.featured_image_url` and `posts.featured_image_alt` when available.

## Configuration

The importer uses the existing S3/R2 configuration from environment variables:
- `S3_REGION` / `R2_REGION`
- `S3_ENDPOINT` / `R2_ENDPOINT` 
- `S3_ACCESS_KEY_ID` / `R2_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY` / `R2_SECRET_ACCESS_KEY`
- `S3_BUCKET` / `R2_BUCKET`

## Database Schema

The importer requires the `posts.guid` field for idempotency and `posts.featured_image_*` for featured images. Run the migration:

```bash
pnpm drizzle:push
```

## Limitations

- Only imports published posts (skips drafts, pages, custom post types)
- Media downloads require S3/R2 configuration
- Large files may timeout (adjust import batch sizes if needed)
- WordPress shortcodes are not processed (only HTML content)
- Featured image extraction relies on WXR metadata availability (e.g., `_thumbnail_url`); full attachment ID resolution to URL may be added later.

## Testing

Run the integration tests:

```bash
pnpm test -- tests/import-wxr.test.ts
```

The test suite includes unit tests for parsing and integration tests with a sample WXR file. For Admin-only MVP, integration is triggered via server actions and not CLI.