# Backup & Restore

Slice K provides backup and restore functionality for Narravo content and configuration.

## Overview

The backup and restore system allows you to:
- Export all database content to a ZIP archive
- Create portable backups with metadata manifests
- Restore data selectively by slug, date range, or other filters
- Preview changes before applying them with dry-run mode

## Usage

### Creating Backups

```bash
# Create a basic backup
pnpm backup

# Create backup with custom filename
pnpm backup --output my-backup.zip

# Create backup without media manifest
pnpm backup --skip-media

# Verbose output
pnpm backup --verbose
```

### Restoring Backups

```bash
# Preview what would be restored (dry run)
pnpm restore backup.zip --dry-run

# Restore everything
pnpm restore backup.zip

# Restore only specific posts by slug
pnpm restore backup.zip --slugs "post-1,post-2,post-3"

# Restore posts from a date range
pnpm restore backup.zip --start-date 2023-01-01 --end-date 2023-12-31

# Skip user and configuration restoration
pnpm restore backup.zip --skip-users --skip-config

# Verbose output
pnpm restore backup.zip --verbose
```

## Backup Format

Backups are created as ZIP files containing:

- `manifest.json` - Metadata about the backup
- `db/` - JSON exports of all database tables
  - `posts.json`
  - `users.json`
  - `comments.json`
  - `comment_attachments.json`
  - `reactions.json`
  - `redirects.json`
  - `configuration.json`

### Manifest Schema

```json
{
  "version": 1,
  "createdUtc": "2023-01-01T12:00:00Z",
  "tables": {
    "posts": {
      "filename": "db/posts.json",
      "recordCount": 123,
      "sha256": "abc123..."
    }
  },
  "media": [
    {
      "path": "media/images/example.jpg",
      "sha256": "def456...",
      "bytes": 1024
    }
  ],
  "counts": {
    "posts": 123,
    "users": 45,
    "comments": 678,
    "reactions": 90,
    "redirects": 12,
    "configuration": 34
  }
}
```

## Features

### Selective Restore
- Filter by post slugs to restore only specific content
- Date range filtering to restore posts from a time period
- Skip users or configuration during restore

### Dry Run Mode
- Preview all changes before applying them
- Shows counts of records to insert, update, or skip
- Safe way to verify backup contents

### Conflict Resolution
- Updates existing records based on GUID or slug matching
- Preserves referential integrity where possible
- Logs conflicts and skipped records

### Media Handling
- Creates manifest of media files referenced in content
- Placeholder for future full media backup/restore
- Tracks file paths, hashes, and sizes

## Implementation Notes

- Uses JSZip for archive creation and extraction
- Maintains referential integrity during restore
- Supports incremental and full backup strategies
- Compatible with TypeScript strict mode
- Includes comprehensive test coverage

## Security Considerations

- Backup files may contain sensitive data
- Store backups securely and encrypt if needed
- Verify backup integrity using manifest hashes
- Test restore procedures regularly

## Limitations

- Media files are not physically included in MVP (manifest only)
- Large databases may require streaming for performance
- No built-in encryption (use external tools if needed)
- Restore operations are not atomic (use database transactions where possible)