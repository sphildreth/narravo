<!-- SPDX-License-Identifier: Apache-2.0 -->
# Upload and Featured Image Troubleshooting Guide

This document explains how to diagnose and fix issues with uploading featured images and post images in production.

## Overview

The application has comprehensive logging to help diagnose permission and upload issues. To enable debug logging in production, set the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug
```

## Upload Flow

### 1. Featured Image Upload (Post Creation/Editing)

**Flow:**
1. User selects featured image in post editor
2. Form submits with `featuredImageFile` as File object
3. Server action (`createPost` or `updatePost`) processes the file
4. File is saved to storage (S3/R2 or local filesystem)
5. Database record is updated with `featuredImageUrl`

**Log Points:**
- `[createPost]` / `[updatePost]` - Initial processing
- `[createPost] Processing featured image upload:` - File details logged
- `[createPost] Uploading to cloud storage (S3/R2):` or `[createPost] Uploading to local storage:` - Storage method chosen
- `[createPost] Cloud upload successful:` or `[createPost] Local upload successful:` - Upload completed
- `[createPost] Post created successfully with ID:` - Database update completed
- `[createPost] Error uploading featured image:` - Upload failed (check error details)

**Files:**
- `src/app/(admin)/admin/posts/actions.ts` - Server actions with logging

### 2. Editor Image Upload (Drag/Drop or Insert)

**Flow:**
1. User drops image or clicks "Image" button in editor
2. Editor calls `/api/r2/sign` to get upload credentials
3. Editor uploads file to signed URL (S3/R2) or `/api/uploads/local`
4. Upload is tracked in database as "temporary"
5. When post is saved, `commitUploadsForPost` marks images as "committed"

**Log Points:**
- `[/api/r2/sign] POST request received` - Sign request initiated
- `[/api/r2/sign] Request - filename:` - File details logged
- `[/api/r2/sign] No S3/R2 config found, using local storage` - Local storage fallback
- `[/api/r2/sign] S3/R2 config found, generating presigned URL` - Cloud storage selected
- `[/api/r2/sign] Generated local upload policy` or `Generated presigned URL` - Credentials created
- `[/api/uploads/local] POST request received` - Local upload started (if using local storage)
- `[/api/uploads/local] File details` - Uploaded file information
- `[/api/uploads/local] Saving file to local storage:` - File being written
- `[LocalStorage] putObject` - Detailed local storage operations
- `[LocalStorage] File written successfully:` - File write completed
- `[LocalStorage] File verification` - File size and permissions verified

**Files:**
- `src/app/api/r2/sign/route.ts` - Upload credential generation
- `src/app/api/uploads/local/route.ts` - Local file upload handler
- `src/lib/local-storage.ts` - Local filesystem operations

## Common Issues and Solutions

### Issue 1: "Failed to upload featured image" Error

**Symptoms:**
- Error message when saving post with featured image
- Featured image doesn't appear on published post

**Diagnosis:**
1. Check logs for `[createPost] Error uploading featured image:` or `[updatePost] Error uploading featured image:`
2. Look for preceding logs showing storage method chosen
3. Check file details (size, type) in error log

**Common Causes:**
- **Permission denied (local storage):** Upload directory not writable
- **S3/R2 credentials invalid:** Cloud storage configuration incorrect
- **File too large:** Exceeds 5MB limit for featured images
- **Invalid file type:** Not in allowed list (jpeg, png, webp, gif)

**Solutions:**
```bash
# Check directory permissions (local storage)
ls -la public/uploads/featured/
# Should show drwxr-xr-x or similar (755)

# Fix permissions if needed
chmod -R 755 public/uploads/
chown -R <your-app-user>:<your-app-group> public/uploads/

# Verify directory exists
mkdir -p public/uploads/featured/

# Check S3/R2 environment variables (cloud storage)
echo $S3_ENDPOINT
echo $S3_REGION
echo $S3_ACCESS_KEY_ID
# (Don't echo SECRET_ACCESS_KEY in production!)
```

### Issue 2: Editor Images Not Uploading

**Symptoms:**
- Drag/drop does nothing
- Image button uploads but image doesn't appear
- Console errors in browser

**Diagnosis:**
1. Open browser DevTools → Network tab
2. Try uploading an image
3. Check for failed requests to `/api/r2/sign` or `/api/uploads/local`
4. Check server logs for corresponding API route errors

**Common Causes:**
- **Missing upload configuration:** Database config values not set
- **Directory permissions (local):** Cannot write to `public/uploads/images/`
- **S3/R2 CORS:** Cloud storage not configured for browser uploads
- **Session/auth issue:** User not properly authenticated

**Solutions:**
```bash
# Verify upload configuration in database
psql $DATABASE_URL -c "SELECT key, value FROM configurations WHERE key LIKE 'UPLOADS.%';"

# Expected values:
# UPLOADS.IMAGE-MAX-BYTES: 10485760 (10MB)
# UPLOADS.VIDEO-MAX-BYTES: 104857600 (100MB)
# UPLOADS.VIDEO-MAX-DURATION-SECONDS: 120
# UPLOADS.ALLOWED-MIME-IMAGE: ["image/jpeg","image/png","image/gif","image/webp"]
# UPLOADS.ALLOWED-MIME-VIDEO: ["video/mp4","video/webm"]

# Seed default config if missing
pnpm seed:config

# Check directory structure and permissions
ls -la public/uploads/
# Should have: images/, videos/, featured/ subdirectories

# Create directories if missing
mkdir -p public/uploads/{images,videos,featured}
chmod -R 755 public/uploads/
```

### Issue 3: Uploads Work Locally But Fail in Production

**Symptoms:**
- Everything works in development
- Same operations fail in production/Docker
- Files upload successfully but return 404 when accessed

**Common Causes:**
- **Volume mounts not configured:** Docker container can't persist files or Next.js can't serve them
- **Different user/permissions:** Production runs as different user than development
- **Environment variables missing:** S3/R2 config not set in production
- **Next.js static file serving:** Uploaded files not accessible to Next.js

**Solutions for Docker:**

Check your `docker-compose.yml` or `docker-compose.prod.yml`:

```yaml
services:
  app:
    # ... other config ...
    volumes:
      # REQUIRED for local storage - persists uploads and makes them accessible to Next.js
      - narravo_uploads:/app/public/uploads
    environment:
      # If using S3/R2, ensure these are set
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION}
      - S3_BUCKET=${S3_BUCKET}
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
      # Optional: R2-specific
      - R2_PUBLIC_URL=${R2_PUBLIC_URL}

volumes:
  narravo_uploads:  # Add this volume definition
```

**Why the volume mount is critical:**

1. **Persistence**: Without a volume, uploaded files are lost when the container restarts
2. **Next.js static serving**: Next.js serves files from `public/` directory at build time. For runtime uploads:
   - The volume mount makes the directory accessible to the running container
   - Next.js can then serve files from `/uploads/*` paths
   - Files written after build time are accessible via the volume

3. **File accessibility**: The volume ensures:
   - Files written by the app are persisted
   - Next.js static file server can read them
   - Files survive container rebuilds/restarts

Check file ownership in container:

```bash
# Enter container
docker exec -it <container-name> sh

# Check user running the app
id

# Check upload directory ownership
ls -la /app/public/uploads/

# Fix ownership if needed (as root)
chown -R node:node /app/public/uploads/
```

### Issue 4: Images Upload But Don't Display

**Symptoms:**
- Upload succeeds (no errors)
- Image URL is saved in database
- Image doesn't load on published post (404 or broken)
- Server logs show file written successfully
- Browser console shows 404 for `/uploads/images/filename.jpg`

**Diagnosis:**
1. Check the `featuredImageUrl` value in database
2. Try accessing the URL directly in browser
3. Check server logs for 404 errors
4. Inspect HTML source to see actual URL rendered
5. Verify file exists on filesystem: `ls -la /opt/narravo/public/uploads/images/`

**Common Causes:**
- **Wrong public URL (S3/R2):** `R2_PUBLIC_URL` or public URL configuration incorrect
- **File not accessible:** Permissions prevent reading
- **Next.js production build:** Files created after build not served (see solution below)
- **CDN/proxy issue:** Reverse proxy not configured to serve `/uploads/`

**Solution for Non-Docker Deployments (systemd/PM2):**

Next.js in production mode (`next start`) serves static files from the build output, not from the source `public/` directory. Files uploaded **after** the build need a custom route handler.

The solution is already implemented in `src/app/uploads/[...path]/route.ts` which serves files from `public/uploads/` at runtime.

**Verify the fix:**
```bash
# Check if file exists
ls -la /opt/narravo/public/uploads/images/

# Test accessing via the API route
curl -I https://your-domain.com/uploads/images/test-file.jpg
# Should return: HTTP/1.1 200 OK

# Check recent deployment included the route
ls -la /opt/narravo/src/app/uploads/\[...path\]/route.ts
# Should exist
```

**If route file is missing:**
```bash
# Pull latest code
cd /opt/narravo
sudo -u narravo git fetch --tags
sudo -u narravo git checkout main  # or your tag
sudo -u narravo git pull

# Verify file exists
ls -la src/app/uploads/\[...path\]/route.ts

# Rebuild and restart
sudo systemctl stop narravo
sudo -u narravo pnpm install
sudo -u narravo pnpm build
sudo systemctl start narravo
```

**Solutions:**
```bash
# Check database value
psql $DATABASE_URL -c "SELECT id, title, \"featuredImageUrl\" FROM posts WHERE \"featuredImageUrl\" IS NOT NULL LIMIT 5;"

# For local storage - verify file exists
ls -la public/uploads/featured/

# For S3/R2 - verify public access
# Check bucket CORS and public access settings in your provider dashboard

# For reverse proxy (nginx/Caddy) - ensure static files served
# Example Caddyfile snippet:
# handle /uploads/* {
#   root * /app/public
#   file_server
# }

# Example nginx snippet:
# location /uploads/ {
#   root /app/public;
# }
```

## Monitoring and Debugging

### Enable Debug Logging

Set environment variable:

```bash
# In .env or docker-compose.yml
LOG_LEVEL=debug
```

This enables detailed logging at all checkpoints:
- File reception and validation
- Storage method selection (S3/R2 vs local)
- Directory creation and permissions
- File write operations
- Database tracking
- Success/failure with full context

### Key Log Messages to Watch

**Success Pattern (Featured Image):**
```
[createPost] Processing featured image upload: example.jpg, size: 123456 bytes, type: image/jpeg
[createPost] Uploading to local storage: featured/abc-123.jpg
[LocalStorage] putObject - key: featured/abc-123.jpg, size: 123456 bytes, type: image/jpeg
[LocalStorage] Target file path: /app/public/uploads/featured/abc-123.jpg
[LocalStorage] Directory ensured: /app/public/uploads/featured
[LocalStorage] File written successfully: /app/public/uploads/featured/abc-123.jpg
[LocalStorage] File verification - size: 123456 bytes, mode: 100644
[createPost] Local upload successful: /uploads/featured/abc-123.jpg
[createPost] Creating post with slug: my-post, featuredImageUrl: /uploads/featured/abc-123.jpg
[createPost] Post created successfully with ID: 42
```

**Success Pattern (Editor Image):**
```
[/api/r2/sign] POST request received
[/api/r2/sign] Request - filename: image.png, mimeType: image/png, size: 234567, kind: image
[/api/r2/sign] No S3/R2 config found, using local storage
[/api/r2/sign] Generated local upload policy - key: images/1234567890-abc.png, publicUrl: /uploads/images/1234567890-abc.png
[/api/uploads/local] POST request received
[/api/uploads/local] File details - name: image.png, size: 234567 bytes, type: image/png
[/api/uploads/local] Saving file to local storage: images/1234567890-abc.png
[LocalStorage] putObject - key: images/1234567890-abc.png, size: 234567 bytes, type: image/png
[LocalStorage] File written successfully: /app/public/uploads/images/1234567890-abc.png
[/api/uploads/local] File saved successfully, URL: /uploads/images/1234567890-abc.png
[/api/uploads/local] Upload tracked in database successfully
```

**Error Pattern (Permission Denied):**
```
[createPost] Processing featured image upload: example.jpg, size: 123456 bytes, type: image/jpeg
[createPost] Uploading to local storage: featured/abc-123.jpg
[LocalStorage] putObject - key: featured/abc-123.jpg, size: 123456 bytes, type: image/jpeg
[LocalStorage] Target file path: /app/public/uploads/featured/abc-123.jpg
[LocalStorage] Error writing file /app/public/uploads/featured/abc-123.jpg: { code: 'EACCES', errno: -13 }
[createPost] Error uploading featured image: { code: 'EACCES', errno: -13 }
[createPost] Featured image details - name: example.jpg, size: 123456, type: image/jpeg
```

### Viewing Logs

**Docker:**
```bash
# Follow logs in real-time
docker logs -f <container-name>

# Show last 100 lines
docker logs --tail 100 <container-name>

# Search for specific errors
docker logs <container-name> 2>&1 | grep -i "error uploading"
docker logs <container-name> 2>&1 | grep -i "LocalStorage"
```

**PM2 or systemd:**
```bash
# PM2
pm2 logs narravo --lines 100

# systemd
journalctl -u narravo -n 100 -f
```

## Quick Diagnostic Script

Save this as `scripts/check-uploads.sh`:

```bash
#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

echo "=== Upload Directory Diagnostic ==="
echo ""

echo "1. Checking directory structure..."
ls -la public/uploads/ 2>/dev/null || echo "ERROR: public/uploads/ does not exist!"

echo ""
echo "2. Checking subdirectories..."
for dir in images videos featured; do
  if [ -d "public/uploads/$dir" ]; then
    echo "✓ public/uploads/$dir exists"
    ls -ld public/uploads/$dir
  else
    echo "✗ public/uploads/$dir MISSING"
  fi
done

echo ""
echo "3. Checking recent uploads..."
find public/uploads/ -type f -mtime -1 2>/dev/null | head -10 || echo "No recent files or directory not accessible"

echo ""
echo "4. Checking permissions..."
echo "Current user: $(whoami) ($(id -u):$(id -g))"
if command -v stat >/dev/null 2>&1; then
  stat -c "Owner: %U (%u), Group: %G (%g), Mode: %a" public/uploads/ 2>/dev/null || stat -f "Owner: %Su (%u), Group: %Sg (%g), Mode: %Lp" public/uploads/
fi

echo ""
echo "5. Testing write permissions..."
TEST_FILE="public/uploads/.write-test-$$"
if touch "$TEST_FILE" 2>/dev/null; then
  echo "✓ Can write to public/uploads/"
  rm "$TEST_FILE"
else
  echo "✗ CANNOT write to public/uploads/ - PERMISSION DENIED"
fi

echo ""
echo "6. Checking disk space..."
df -h public/uploads/ 2>/dev/null || df -h .

echo ""
echo "=== End Diagnostic ==="
```

Run it:
```bash
chmod +x scripts/check-uploads.sh
./scripts/check-uploads.sh
```

## Deploying the Fix

If you've just added the volume mount to `docker-compose.prod.yml`, follow these steps to deploy:

### Step 1: Rebuild the Docker Image

```bash
# Pull latest code
git pull origin main

# Rebuild the image with upload directory structure
docker-compose -f docker-compose.prod.yml build --no-cache web
```

### Step 2: Stop and Remove Old Containers

```bash
# Stop the running containers
docker-compose -f docker-compose.prod.yml down

# Optional: Clean up old images
docker image prune -f
```

### Step 3: Start with New Configuration

```bash
# Start the services with the new volume mount
docker-compose -f docker-compose.prod.yml up -d

# Check logs for any errors
docker-compose -f docker-compose.prod.yml logs -f web
```

### Step 4: Verify Upload Directory

```bash
# Enter the container
docker-compose -f docker-compose.prod.yml exec web sh

# Check if directory structure exists
ls -la /app/public/uploads/

# Should show:
# drwxr-xr-x  images/
# drwxr-xr-x  videos/
# drwxr-xr-x  featured/

# Test file creation
touch /app/public/uploads/images/test.txt
ls -la /app/public/uploads/images/test.txt
rm /app/public/uploads/images/test.txt

# Exit container
exit
```

### Step 5: Test Upload

1. Navigate to admin post editor
2. Try uploading an image via drag-drop or the Image button
3. Check browser console for 404 errors (should be resolved)
4. Verify image appears in the editor
5. Save the post and view it publicly to ensure image displays

### Troubleshooting After Deploy

If uploads still fail after deployment:

```bash
# Check if volume was created
docker volume ls | grep narravo_uploads

# Inspect the volume
docker volume inspect narravo_uploads

# Check container mounts
docker-compose -f docker-compose.prod.yml exec web mount | grep uploads

# Verify Next.js can serve the file
docker-compose -f docker-compose.prod.yml exec web ls -la /app/public/uploads/images/

# Check from host machine using curl
curl -I https://your-domain.com/uploads/images/test-file.jpg
```

## Quick Diagnostic Script

Save this as `scripts/check-uploads.sh`:

```bash
#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

echo "=== Upload Directory Diagnostic ==="
echo ""

echo "1. Checking directory structure..."
ls -la public/uploads/ 2>/dev/null || echo "ERROR: public/uploads/ does not exist!"

echo ""
echo "2. Checking subdirectories..."
for dir in images videos featured; do
  if [ -d "public/uploads/$dir" ]; then
    echo "✓ public/uploads/$dir exists"
    ls -ld public/uploads/$dir
  else
    echo "✗ public/uploads/$dir MISSING"
  fi
done

echo ""
echo "3. Checking recent uploads..."
find public/uploads/ -type f -mtime -1 2>/dev/null | head -10 || echo "No recent files or directory not accessible"

echo ""
echo "4. Checking permissions..."
echo "Current user: $(whoami) ($(id -u):$(id -g))"
if command -v stat >/dev/null 2>&1; then
  stat -c "Owner: %U (%u), Group: %G (%g), Mode: %a" public/uploads/ 2>/dev/null || stat -f "Owner: %Su (%u), Group: %Sg (%g), Mode: %Lp" public/uploads/
fi

echo ""
echo "5. Testing write permissions..."
TEST_FILE="public/uploads/.write-test-$$"
if touch "$TEST_FILE" 2>/dev/null; then
  echo "✓ Can write to public/uploads/"
  rm "$TEST_FILE"
else
  echo "✗ CANNOT write to public/uploads/ - PERMISSION DENIED"
fi

echo ""
echo "6. Checking disk space..."
df -h public/uploads/ 2>/dev/null || df -h .

echo ""
echo "=== End Diagnostic ==="
```

Run it:
```bash
chmod +x scripts/check-uploads.sh
./scripts/check-uploads.sh
```

## Best Practices

1. **Always use volume mounts in Docker** for persistent storage
2. **Set proper permissions** on upload directories (755 for directories, 644 for files)
3. **Enable debug logging** when troubleshooting
4. **Monitor disk space** - uploads can accumulate quickly
5. **Use S3/R2 in production** for better scalability and reliability
6. **Test uploads after deployment** as part of smoke testing
7. **Check logs immediately** if upload issues are reported

## Related Documentation

- `docs/DEVELOPMENT.md` - Development setup
- `deploy/README_DEPLOY.md` - Production deployment guide
- `.env.example` - Environment variable documentation
- `docs/wordpress-import.md` - Bulk upload troubleshooting

## Support

If you continue to experience issues after following this guide:

1. Collect debug logs showing the full upload flow
2. Check browser console for client-side errors
3. Verify environment configuration matches documentation
4. Review recent code changes that might affect upload logic
5. Check GitHub issues for similar problems and solutions
