<!-- SPDX-License-Identifier: Apache-2.0 -->
# Fixing Upload 404 Errors - Deployment Guide

## Problem

Uploaded images return 404 errors when accessed via browser:
- Files upload successfully to `/app/public/uploads/` in container
- Server logs show successful upload
- Browser gets 404 when trying to access `/uploads/images/filename.jpg`

## Root Cause

The `public/uploads/` directory is:
1. In `.gitignore` (correctly, to avoid committing uploads to Git)
2. Not mounted as a volume in Docker Compose
3. Created at runtime, so Next.js can't serve the files

Next.js serves static files from the `public/` directory, but only files that exist at **build time**. Files created at **runtime** need special handling via volume mounts.

## Solution

Add a Docker volume mount for `public/uploads/` so:
- Files persist across container restarts
- Next.js can serve them as static files
- Uploads survive container rebuilds

## Changes Required

### 1. Update `docker-compose.prod.yml`

```diff
  web:
    build:
      context: .
      dockerfile: Dockerfile
    image: narravo-web:prod
    env_file:
      - deploy/.env.example
      - deploy/.env
    depends_on:
      - db
    ports:
      - "3000:3000"
+   volumes:
+     # Persist uploaded files outside the container
+     - narravo_uploads:/app/public/uploads
    restart: unless-stopped

volumes:
  narravo_pg_data:
+ narravo_uploads:
```

### 2. Update `Dockerfile`

```diff
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
+# Create upload directory structure with proper permissions
+RUN mkdir -p /app/public/uploads/images /app/public/uploads/videos /app/public/uploads/featured && \
+    chmod -R 755 /app/public/uploads
EXPOSE 3000
CMD ["/entrypoint.sh"]
```

## Deployment Steps

### Production Deployment

```bash
# 1. Pull latest code with the fixes
git pull origin main

# 2. Rebuild the Docker image
docker-compose -f docker-compose.prod.yml build --no-cache web

# 3. Stop current containers
docker-compose -f docker-compose.prod.yml down

# 4. Start with new configuration
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify logs
docker-compose -f docker-compose.prod.yml logs -f web
```

### Verification

```bash
# Check volume was created
docker volume ls | grep narravo_uploads

# Should output:
# local     narravo_uploads

# Enter container and verify directory structure
docker-compose -f docker-compose.prod.yml exec web sh -c "ls -la /app/public/uploads/"

# Should show:
# drwxr-xr-x    2 root     root          4096 Oct 16 22:00 images
# drwxr-xr-x    2 root     root          4096 Oct 16 22:00 videos
# drwxr-xr-x    2 root     root          4096 Oct 16 22:00 featured
```

### Test Upload

1. Login to admin area: `https://your-domain.com/admin`
2. Create or edit a post
3. Upload an image via drag-drop or Image button
4. Check server logs for upload success:
   ```
   [INFO] [/api/uploads/local] File saved successfully, URL: /uploads/images/...
   ```
5. Verify image displays in editor (should not show 404 in browser console)
6. Save post and view publicly to confirm image loads

## Troubleshooting

### Images still return 404

```bash
# Check if files are actually being written
docker-compose -f docker-compose.prod.yml exec web ls -la /app/public/uploads/images/

# Test if Next.js can serve a test file
docker-compose -f docker-compose.prod.yml exec web sh -c "echo 'test' > /app/public/uploads/test.txt"
curl https://your-domain.com/uploads/test.txt
# Should output: test
```

### Volume permission issues

```bash
# Check volume permissions
docker-compose -f docker-compose.prod.yml exec web ls -ld /app/public/uploads/

# Should be: drwxr-xr-x (755)

# Fix if needed
docker-compose -f docker-compose.prod.yml exec web chmod -R 755 /app/public/uploads/
```

### Existing uploads not appearing

If you had uploads before adding the volume mount, they're lost in the old container layers. You need to:

1. Keep the old container running temporarily
2. Copy files out: `docker cp container:/app/public/uploads ./backup-uploads`
3. Deploy new version with volume mount
4. Copy files back: `docker cp ./backup-uploads/. new-container:/app/public/uploads/`

## For Non-Docker Deployments

If you're deploying without Docker (e.g., directly with PM2 or systemd):

```bash
# Ensure directory exists with correct permissions
mkdir -p public/uploads/{images,videos,featured}
chmod -R 755 public/uploads/

# Set ownership to the user running Next.js
chown -R your-app-user:your-app-group public/uploads/

# Next.js will automatically serve files from public/ directory
```

## Alternative: Use S3/R2 Cloud Storage

For production, consider using cloud storage instead of local filesystem:

1. Set up Cloudflare R2 or AWS S3
2. Configure environment variables:
   ```env
   S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=narravo-uploads
   S3_ACCESS_KEY_ID=xxx
   S3_SECRET_ACCESS_KEY=xxx
   R2_PUBLIC_URL=https://uploads.your-domain.com
   ```
3. Files upload directly to cloud storage
4. No volume mount needed
5. Better for scalability and CDN integration

## Verification Checklist

After deployment, verify:

- [ ] `docker volume ls` shows `narravo_uploads`
- [ ] Container directory exists: `/app/public/uploads/{images,videos,featured}`
- [ ] Directory permissions are `755` (drwxr-xr-x)
- [ ] Upload test in admin succeeds without errors
- [ ] Uploaded image URL loads in browser (no 404)
- [ ] Image displays correctly in published post
- [ ] Server logs show successful upload to local storage
- [ ] No 404 errors in browser console when viewing images

## Success Indicators

You know it's working when:

1. **Server logs** show:
   ```
   [INFO] [LocalStorage] File written successfully: /app/public/uploads/images/xxx.jpg
   [INFO] [/api/uploads/local] File saved successfully, URL: /uploads/images/xxx.jpg
   ```

2. **Browser network tab** shows:
   ```
   GET /uploads/images/xxx.jpg  200 OK
   ```

3. **Image displays** correctly in both editor and published post

4. **After container restart**, previously uploaded images still accessible
