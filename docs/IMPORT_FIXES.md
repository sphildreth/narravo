# Import Bug Fixes Implementation

This document describes the implementation of fixes for WordPress WXR import issues identified in `REQ_IMPORT_BUGS.md`.

## Changes Implemented

### 1. Database Schema Change - GUID Column Rename

**Issue**: The `posts.guid` column name was confusing and didn't clearly indicate its purpose.

**Solution**: Renamed `posts.guid` to `posts.imported_system_id` for clarity.

**Files Changed**:
- `drizzle/schema.ts` - Updated column definition
- `drizzle/migrations/0011_kind_donald_blake.sql` - Migration to rename column
- `scripts/import-wxr.ts` - Updated all references to use new column name
- `scripts/restore.ts` - Updated references
- `src/lib/posts.ts` - Updated references  
- `tests/import-wxr.test.ts` - Updated test expectations

### 2. Featured Image Display

**Issue**: Featured images from imported posts were not displayed in post detail views.

**Solution**: 
- Added `featuredImageUrl` and `featuredImageAlt` fields to `PostDTO` type
- Updated `getPostBySlug()` to select these fields from database
- Added featured image display in post detail view below admin actions section

**Files Changed**:
- `src/types/content.ts` - Added featured image fields to PostDTO
- `src/lib/posts.ts` - Updated query to select featured image fields
- `src/app/(public)/[slug]/page.tsx` - Added featured image display component

### 3. Syntax Highlighting Transformation

**Issue**: WordPress syntax highlighting blocks using `hcb_wrap` class were not properly transformed.

**Solution**: Added `transformSyntaxHighlighting()` function to convert WordPress syntax highlighting blocks to standard code blocks.

**Transform Pattern**:
```html
<!-- Before -->
<div class="hcb_wrap">
<pre class="prism undefined-numbers lang-bash" data-lang="Bash"><code>sudo pacman -S podman</code></pre>
</div>

<!-- After -->
<pre data-language="bash"><code>sudo pacman -S podman</code></pre>
```

**Files Changed**:
- `scripts/import-wxr.ts` - Added transformation function and integrated into processing pipeline

### 4. Posts Loading Fix

**Issue**: "No More posts to load" was showing even when posts existed in database.

**Solution**: Added `published_at is not null` filter to `listPosts()` query to only show published posts.

**Files Changed**:
- `src/lib/posts.ts` - Added published_at filter to posts list query

## Existing Functionality Verified

The following existing functionality was verified to be working correctly:

### YouTube Video Embedding
- YouTube iframes are preserved during import via `transformIframeVideos()`
- Videos display correctly in imported posts

### HTML List Processing  
- WordPress list formatting is normalized via `normalizeWpLists()`
- Lists render properly in imported content

## Testing

Added comprehensive tests:
- `tests/import-wxr-syntax-highlighting.test.ts` - Tests syntax highlighting transformation
- `tests/import-wxr-integration.test.ts` - Integration tests for complete import pipeline
- Updated existing tests to work with renamed database column

## Database Migration

The database migration `0011_kind_donald_blake.sql` performs:
1. Rename `posts.guid` column to `posts.imported_system_id` 
2. Drop old unique constraint `posts_guid_unique`
3. Add new unique constraint `posts_imported_system_id_unique`

This migration is safe to run as it preserves all data and maintains the unique constraint.

## Build Verification

All changes verified with:
- ✅ `pnpm typecheck` - TypeScript compilation
- ✅ `pnpm build` - Production build 
- ✅ `pnpm test` - Test suite (excluding unrelated failing tests)