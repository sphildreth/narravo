# WordPress WXR Import Feature

The WordPress WXR Import feature allows administrators to import content from WordPress XML export files directly through the admin interface.

## Accessing the Import Feature

1. Log in as an administrator
2. Navigate to **Admin** → **System** → **Import**
3. Upload a WordPress WXR (.xml) export file

## Import Options

### Post Statuses
Choose which WordPress post statuses to import:
- **Published only** (default)
- **Published + Drafts**
- **Published + Drafts + Private**
- **All statuses** (includes pending)

### Import Options
- **Dry run**: Preview the import without making any changes
- **Skip media downloads**: Import content without downloading media files
- **Purge all data before import**: ⚠️ **DESTRUCTIVE** - Removes all existing posts, comments, categories, tags, redirects, and uploaded files

### Advanced Options
- **Concurrency**: Number of simultaneous media downloads (1-10, default: 4)
- **Allowed Media Hosts**: Whitelist of domains for media downloads (empty = allow all)

## What Gets Imported

### Content
- **Posts**: Title, content, excerpt, publication date, author
- **Comments**: Content, author info, threading/replies, approval status
- **Categories**: Names and slugs (hierarchy flattened)
- **Tags**: Names and slugs
- **Media**: Images, videos, and other attachments (when S3/R2 configured)
- **Users**: Authors and commenters (placeholder accounts created)

### SEO & Navigation
- **Redirects**: 301 redirects from old WordPress URLs to new post URLs
- **Featured Images**: Post thumbnails when `_thumbnail_id` metadata present
- **URL Rewriting**: Internal media URLs updated to new locations

## Import Process

1. **Upload & Validation**: File type and structure validation
2. **Job Creation**: Import job record created with options
3. **Processing**: Content parsed and imported with progress tracking
4. **Media Downloads**: Attachments downloaded to S3/R2 storage
5. **URL Rewriting**: Content URLs updated to new media locations
6. **Redirect Creation**: Old URLs mapped to new post locations

> Image Policy: During URL rewriting, remote images are not allowed. Each encountered image is downloaded and served locally. If an image cannot be downloaded (blocked host, network error, unsupported), it is replaced with a local placeholder at `/images/image-cannot-be-downloaded.svg`. Protocol-relative (`//host/...`) URLs are treated as remote.

## Monitoring & Management

### Job Status
- **Queued**: Job created, waiting to start
- **Running**: Import in progress
- **Cancelling**: Cancel requested, stopping gracefully
- **Cancelled**: Import stopped by user
- **Failed**: Import encountered errors
- **Completed**: Import finished successfully

### Progress Tracking
- Real-time progress bar during import
- Item counts: total, posts, attachments, redirects, skipped
- Detailed error logging for failed items

### Job Management
- **Cancel**: Stop a running import
- **Retry**: Restart a failed or cancelled import
- **View Details**: See comprehensive job information and errors

## Error Handling

### Common Error Types
- **Media Download**: Failed to download attachment files
- **Post Import**: Failed to create or update post records
- **Redirect Creation**: Failed to create URL redirects
- **Fatal Error**: Critical system errors

### Error Details
Each error includes:
- Item identifier (GUID, URL, etc.)
- Error message and type
- Relevant item data for debugging
- Timestamp of occurrence

## Requirements

### Database
- PostgreSQL database with import job tables
- Required schema: `import_jobs`, `import_job_errors`

### Storage (Optional)
For media downloads, configure S3 or Cloudflare R2:
- `S3_REGION` / `R2_REGION`
- `S3_ENDPOINT` / `R2_ENDPOINT`
- `S3_ACCESS_KEY_ID` / `R2_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY` / `R2_SECRET_ACCESS_KEY`
- `S3_BUCKET` / `R2_BUCKET`

### Permissions
- Admin user account required
- File system write access for temporary files

## Limitations

### Content Support
- Only imports posts (skips pages, custom post types)
- Comments imported only for published posts
- WordPress shortcodes preserved as raw HTML
- No WordPress plugin data or custom fields
### Media & Security
- Remote images are disallowed in imported post content. Import will either:
	- Download and rewrite the image to a local URL, or
	- Replace the element with a placeholder image located at `/images/image-cannot-be-downloaded.svg` if the download fails.
- Featured images follow the same rule and will only be set when a local copy exists.

### Technical Limits
- Maximum file size depends on server configuration
- Large imports may require increased timeout limits
- Concurrent media downloads limited to prevent overload

## Command Line Usage

For large imports or automation, use the CLI script:

```bash
# Basic import
pnpm wxr:import -- path=./export.xml

# Dry run preview
pnpm wxr:import -- path=./export.xml --dry-run

# Skip media downloads
pnpm wxr:import -- path=./export.xml --skip-media

# Verbose output with concurrency control
pnpm wxr:import -- path=./export.xml --verbose concurrency=8

# Offline import with local media files and complete purge
pnpm wxr:import -- path=./export.xml --purge uploads=/path/to/wp-uploads root='^https?://oldsite\.com$' --verbose

# Import with allowed hosts filter
pnpm wxr:import -- path=./export.xml allowedHosts=example.com,cdn.example.com --verbose
```

### CLI Options
- `path=<file>`: (Required) Path to WXR export file
- `--verbose`: Enable detailed logging
- `--dry-run`: Preview without making changes
- `--skip-media`: Skip media downloads
- `--rebuild-excerpts`: Regenerate all excerpts
- `--purge`: ⚠️ **Delete all posts, comments, categories, tags, redirects, and uploaded files**
- `uploads=<path>`: Local uploads directory for offline import
- `root=<pattern>`: Regex pattern for old site URL (required with uploads)
- `allowedHosts=<hosts>`: Comma-separated allowed domains
- `concurrency=<number>`: Simultaneous downloads (1-10, default: 4)

## Troubleshooting

### Import Fails to Start
- Check file format (must be .xml)
- Verify admin permissions
- Check disk space for temporary files

### Media Download Errors
- Verify S3/R2 configuration
- Check network connectivity to source URLs
- Review allowed hosts whitelist

### High Memory Usage
- Use CLI for very large imports
- Reduce concurrency setting
- Process in smaller batches

### Performance Issues
- Import during low traffic periods
- Use `--skip-media` for content-only imports
- Monitor server resources during import

## Best Practices

1. **Test First**: Always run a dry-run before live import
2. **Backup**: Create database backup before importing
3. **Media Strategy**: Configure S3/R2 before importing media-heavy sites
4. **Incremental**: For large sites, consider importing in smaller batches
5. **Monitoring**: Watch import progress and error logs closely
6. **Cleanup**: Remove temporary files after completed imports