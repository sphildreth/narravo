# Media Uploads for Comments (Slice E)

This feature enables users to upload images and videos as attachments to comments using direct-to-S3/R2 uploads.

## Features

- **Image Support**: JPEG, PNG, GIF, WebP up to 5MB
- **Video Support**: MP4, WebM up to 50MB and 90 seconds
- **Presigned URLs**: Direct client-to-S3/R2 uploads for better performance
- **Video Posters**: Automatic poster generation for videos (MVP uses placeholders)
- **Validation**: Server-side MIME type and size validation
- **Moderation**: Attachments inherit comment moderation status

## Configuration

The following configuration keys control upload behavior:

```typescript
UPLOADS.IMAGE-MAX-BYTES: 5000000  // 5MB
UPLOADS.VIDEO-MAX-BYTES: 50000000 // 50MB  
UPLOADS.VIDEO-MAX-DURATION-SECONDS: 90
UPLOADS.ALLOWED-MIME-IMAGE: ["image/jpeg", "image/png", "image/gif", "image/webp"]
UPLOADS.ALLOWED-MIME-VIDEO: ["video/mp4", "video/webm"]
```

## Environment Variables (Optional)

For production S3/R2 integration:

```bash
# AWS S3
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=your-bucket

# Cloudflare R2 (recommended)
R2_REGION=auto
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET=your-bucket
```

If not configured, the system works in development mode with mock responses.

## API Endpoints

### POST /api/r2/sign

Request presigned upload URL for media files.

**Request:**
```json
{
  "filename": "image.jpg",
  "mimeType": "image/jpeg", 
  "size": 1024000,
  "kind": "image"
}
```

**Response:**
```json
{
  "url": "https://presigned-upload-url",
  "fields": { "Content-Type": "image/jpeg" },
  "key": "images/abc123.jpg",
  "policy": {
    "kind": "image",
    "limits": {
      "imageMaxBytes": 5000000,
      "videoMaxBytes": 50000000, 
      "videoMaxDurationSeconds": 90
    }
  }
}
```

## Database Schema

Comments can have multiple attachments via the `comment_attachments` table:

```sql
CREATE TABLE comment_attachments (
  id UUID PRIMARY KEY,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'image' | 'video'
  url TEXT NOT NULL,
  poster_url TEXT, -- For videos only
  mime TEXT,
  bytes INTEGER
);
```

## Usage in Components

```tsx
import CommentUpload from "@/components/CommentUpload";

function CommentForm() {
  const [attachments, setAttachments] = useState([]);
  
  return (
    <form>
      <CommentUpload 
        onFilesChange={setAttachments}
        maxFiles={3}
      />
    </form>
  );
}
```

## Video Processing (Future Enhancement)

The current MVP uses placeholder posters for videos. In production, implement:

1. **ffmpeg Integration**: Extract frames from uploaded videos
2. **Queue System**: Process video tasks asynchronously 
3. **Duration Validation**: Verify actual video length
4. **Thumbnails**: Generate multiple poster options

## Security Notes

- All uploads require authentication
- Server validates MIME types using magic number detection
- Comments with attachments follow the same moderation flow
- Rate limiting applies to comment creation including attachments

## Testing

Run tests for upload functionality:

```bash
pnpm test tests/s3.test.ts
pnpm test tests/jobs.test.ts
```

## Troubleshooting

**"Missing required config" errors**: Run `pnpm seed:config` to initialize upload configuration.

**S3/R2 connection issues**: Verify environment variables and permissions. The system gracefully falls back to development mode if S3/R2 is not configured.

**Large file uploads**: Check both client and server size limits. Consider implementing chunked uploads for very large files in future iterations.