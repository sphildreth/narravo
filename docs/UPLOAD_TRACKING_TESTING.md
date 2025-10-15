# Upload Tracking System - Testing Guide

## Overview

This document describes how to test the new upload tracking system that fixes the issue with images not working properly in new posts.

## What Was Fixed

**Original Issue:** "Adding a new image to a new post doesn't work you get a broken image and the image does not appear when published"

**Root Cause:** Images were uploaded immediately to permanent storage with no lifecycle management. When users abandoned post creation, orphaned images accumulated. There was also no tracking to understand which images belonged to which posts.

**Solution:** Implemented comprehensive upload tracking with temporary/committed states and cleanup mechanisms.

## System Architecture

### Upload Lifecycle

1. **Upload (Temporary State)**
   - User uploads image in editor
   - Image saved to storage (local or S3/R2)
   - Record created in `uploads` table with `status='temporary'`
   - `sessionId` tracks uploads before post exists
   - `userId` tracks who uploaded the file

2. **Commit (On Post Save)**
   - User saves/publishes post
   - System extracts image URLs from markdown
   - Matching uploads updated to `status='committed'`
   - `postId` associated with the upload
   - `committedAt` timestamp recorded

3. **Cleanup (Periodic)**
   - Cron job runs `cleanup:uploads` script
   - Finds temporary uploads older than threshold (default 24h)
   - Deletes files from storage
   - Removes database records

### Database Schema

```sql
CREATE TYPE upload_status AS ENUM('temporary', 'committed');

CREATE TABLE uploads (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,         -- Storage key (e.g., "images/xxx.jpg")
  url TEXT NOT NULL,                -- Public URL
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  status upload_status DEFAULT 'temporary',
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  session_id TEXT,                  -- For tracking before post creation
  created_at TIMESTAMP DEFAULT NOW(),
  committed_at TIMESTAMP
);
```

## Testing Instructions

### Prerequisites

1. **Run Migration**
   ```bash
   npm run drizzle:migrate
   ```

2. **Verify Migration**
   ```bash
   npm run drizzle:check
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

### Test Case 1: Create Post with Images

**Objective:** Verify images are tracked and committed when post is saved.

**Steps:**
1. Navigate to `/admin/posts`
2. Click "New Post"
3. Fill in title: "Test Post with Images"
4. Upload an image using the image button in the editor toolbar
5. Verify image appears in the editor
6. Click "Save Draft"

**Verification:**
```sql
-- Check uploads table
SELECT key, url, status, post_id, session_id, committed_at 
FROM uploads 
WHERE url LIKE '%test%' 
ORDER BY created_at DESC;

-- Should see record with:
-- - status = 'committed'
-- - post_id = [your post ID]
-- - committed_at = [timestamp]
```

**Expected Result:** Image appears in editor, post saves successfully, upload is committed.

### Test Case 2: Abandon Post Creation

**Objective:** Verify orphaned images remain temporary and can be cleaned up.

**Steps:**
1. Navigate to `/admin/posts`
2. Click "New Post"
3. Upload an image
4. Verify image appears in editor
5. Click "Cancel" (navigate away without saving)

**Verification:**
```sql
-- Check for temporary uploads
SELECT key, url, status, post_id, session_id, created_at
FROM uploads 
WHERE status = 'temporary'
ORDER BY created_at DESC;

-- Should see record with:
-- - status = 'temporary'
-- - post_id = NULL
-- - session_id = [editor session ID]
```

**Expected Result:** Upload remains temporary with no post association.

### Test Case 3: Manual Cleanup

**Objective:** Verify cleanup script removes orphaned uploads.

**Steps:**
1. Create some temporary uploads (follow Test Case 2)
2. Run cleanup in dry-run mode:
   ```bash
   npm run cleanup:uploads -- --dry-run
   ```
3. Review output showing what would be deleted
4. If uploads are recent (<24h), use lower threshold:
   ```bash
   npm run cleanup:uploads -- --dry-run --age-hours=0
   ```
5. Run actual cleanup:
   ```bash
   npm run cleanup:uploads -- --age-hours=0
   ```

**Verification:**
```sql
-- Check that temporary uploads were removed
SELECT COUNT(*) FROM uploads WHERE status = 'temporary';
-- Should be 0 or reduced
```

**Expected Result:** Script deletes old temporary uploads.

### Test Case 4: Multiple Images in One Post

**Objective:** Verify multiple images are all committed together.

**Steps:**
1. Create new post
2. Upload 3 different images
3. Insert all 3 images into the markdown
4. Save the post

**Verification:**
```sql
-- Check all images are committed to the same post
SELECT key, url, status, post_id
FROM uploads 
WHERE post_id = '[your post ID]'
ORDER BY created_at DESC;

-- Should see 3 records with status = 'committed'
```

**Expected Result:** All images committed to the post.

### Test Case 5: Edit Existing Post with New Images

**Objective:** Verify adding images to existing post works correctly.

**Steps:**
1. Open existing post for editing
2. Upload and add a new image
3. Save the post

**Verification:**
```sql
-- Check new upload is committed to existing post
SELECT key, url, status, post_id, committed_at
FROM uploads 
WHERE post_id = '[existing post ID]'
ORDER BY created_at DESC;

-- Should see new image with recent committed_at
```

**Expected Result:** New image committed to existing post.

### Test Case 6: Session Tracking

**Objective:** Verify sessionId tracking before post creation.

**Steps:**
1. Open browser dev tools, go to Network tab
2. Create new post
3. Upload an image
4. In network tab, find the upload POST request
5. Check request payload for `sessionId` field

**Expected Result:** sessionId is passed with upload request.

### Test Case 7: Published Post Display

**Objective:** Verify images display correctly in published posts.

**Steps:**
1. Create and publish a post with images
2. Navigate to the post's public URL
3. Verify all images display correctly
4. Check browser dev tools for any 404 errors

**Expected Result:** All images load successfully, no broken images.

## Automated Tests

Run the upload tracking test suite:

```bash
npm test upload-tracking
```

This verifies:
- Temporary upload creation
- Upload commitment workflow
- Image URL extraction from markdown
- Cleanup logic
- Schema constraints

## Monitoring

### Check Upload Statistics

```sql
-- Count uploads by status
SELECT status, COUNT(*) 
FROM uploads 
GROUP BY status;

-- Recent uploads
SELECT key, status, created_at, committed_at, post_id
FROM uploads 
ORDER BY created_at DESC 
LIMIT 10;

-- Orphaned uploads older than 24h
SELECT key, created_at, 
       EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as age_hours
FROM uploads 
WHERE status = 'temporary'
  AND created_at < NOW() - INTERVAL '24 hours'
ORDER BY created_at;

-- Storage usage by status
SELECT status, 
       COUNT(*) as count,
       SUM(size)/1024/1024 as size_mb
FROM uploads 
GROUP BY status;
```

### Set Up Monitoring

Consider setting up alerts for:
- High number of temporary uploads (>100)
- Old temporary uploads (>7 days)
- Large storage usage (>1GB of temporary files)

## Production Deployment

1. **Deploy Code Changes**
   ```bash
   git pull
   npm install
   npm run build
   ```

2. **Run Migration**
   ```bash
   npm run drizzle:migrate
   ```

3. **Set Up Cron Job**
   ```bash
   # Add to crontab
   0 2 * * * cd /path/to/narravo && npm run cleanup:uploads
   ```

4. **Monitor for Issues**
   - Check logs for cleanup errors
   - Verify no orphaned temporary uploads accumulating
   - Confirm images in new posts display correctly

## Troubleshooting

### Issue: Images still broken in new posts

**Possible Causes:**
1. Migration not run
2. Upload API not tracking uploads
3. Commit function not being called

**Debug Steps:**
```sql
-- Check if uploads table exists
SELECT * FROM uploads LIMIT 1;

-- Check if uploads are being recorded
SELECT COUNT(*) FROM uploads;

-- Check upload status distribution
SELECT status, COUNT(*) FROM uploads GROUP BY status;
```

### Issue: Cleanup script fails

**Possible Causes:**
1. Database connection issue
2. Storage permissions
3. File already deleted

**Debug Steps:**
```bash
# Run with verbose logging
NODE_ENV=development npm run cleanup:uploads -- --dry-run

# Check database connectivity
npm run drizzle:check
```

### Issue: Too many temporary uploads

**Possible Causes:**
1. Cleanup not running
2. Users frequently abandoning post creation
3. Threshold too high

**Solutions:**
- Run cleanup manually
- Reduce age-hours threshold
- Increase cleanup frequency

## Security Considerations

1. **Admin-Only Uploads:** All upload endpoints require admin authentication
2. **Session Tracking:** sessionId is client-generated but doesn't affect security (only used for grouping)
3. **SQL Injection:** All queries use parameterized statements
4. **File Validation:** MIME type and size validation enforced
5. **Cascade Delete:** When post is deleted, associated uploads are removed

## Performance Considerations

1. **Indexing:** Indexes on status, created_at, post_id, session_id for efficient queries
2. **Cleanup Batch Size:** Cleanup processes all orphaned uploads in one run (consider batching for very large numbers)
3. **Storage I/O:** Cleanup deletes files sequentially (not parallel to avoid overwhelming storage)

## Future Enhancements

Potential improvements for consideration:
- Admin UI for viewing orphaned uploads
- Automatic cleanup based on storage quota
- Image optimization/resizing during upload
- Upload progress indicators
- Bulk commit for multiple posts
- Analytics on upload patterns
