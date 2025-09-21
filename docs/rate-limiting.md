# Rate Limiting & Anti-Abuse (Slice H)

## Overview

This implementation provides comprehensive rate limiting and anti-abuse protection for comment submissions and reaction toggles. It includes three layers of protection:

1. **Rate Limiting**: Limits actions per user+IP combination within time windows
2. **Honeypot Fields**: Detects and blocks automated bot submissions
3. **Minimum Submit Time**: Prevents submissions that are too fast to be human

## Configuration

Rate limiting is configured via the configuration service with the following keys:

- `RATE.COMMENTS-PER-MINUTE` (default: 5) - Maximum comments per minute per user+IP
- `RATE.REACTIONS-PER-MINUTE` (default: 20) - Maximum reactions per minute per user+IP  
- `RATE.MIN-SUBMIT-SECS` (default: 2) - Minimum time between form render and submit

## Implementation

### Core Components

#### `lib/rateLimit.ts`
- `InMemoryRateLimiter` - Sliding window rate limiter with automatic cleanup
- `validateAntiAbuse()` - Combined validation for all anti-abuse measures
- `validateHoneypot()` - Honeypot field validation
- `validateMinSubmitTime()` - Minimum submit time validation

#### Server Actions Updated
- `components/comments/actions.ts` - Comment creation with rate limiting
- `components/reactions/actions.ts` - Reaction toggle with rate limiting

### Rate Limiting Algorithm

Uses a sliding window approach with in-memory storage:
- Tracks requests per unique `action:userId:ipAddress` key
- Automatically expires old entries outside the time window
- Provides immediate feedback on rate limit status
- Returns retry-after timing when limits are exceeded

### Anti-Abuse Protections

#### Honeypot Field
```typescript
// Client-side: Include hidden field in forms
<input type="text" name="honeypot" style="display: none" tabIndex="-1" autoComplete="off" />

// Server validates field is empty
validateHoneypot(formData.get("honeypot")) // Should return true for legitimate users
```

#### Minimum Submit Time
```typescript
// Client-side: Track form render time
const submitStartTime = Date.now();

// Server validates minimum time elapsed
validateMinSubmitTime(submitStartTime) // Must be >= 2 seconds
```

#### Rate Limiting
Automatic per server action - no client-side changes needed.

## Usage Examples

### Comment Creation
```typescript
const result = await createComment({
  postId: "123",
  parentId: null,
  bodyMd: "Comment text",
  honeypot: "", // Should be empty
  submitStartTime: Date.now() - 3000 // 3 seconds ago
});

if (!result.success) {
  // Handle rate limiting or validation errors
  console.error(result.error);
  if (result.rateLimitInfo) {
    console.log(`Retry after: ${result.rateLimitInfo.retryAfter} seconds`);
  }
}
```

### Reaction Toggle
```typescript
const result = await toggleReactionAction("post", "123", "like", {
  honeypot: "",
  submitStartTime: Date.now() - 3000
});

if (result.error) {
  // Handle rate limiting or validation errors
  console.error(result.error);
}
```

## Response Formats

### Success Response
```typescript
{
  success: true,
  // ... other success data
}
```

### Rate Limited Response
```typescript
{
  success: false,
  error: "Rate limit exceeded. Try again in 30 seconds.",
  rateLimitInfo: {
    allowed: false,
    retryAfter: 30,
    limit: 5,
    remaining: 0,
    resetTime: 1701234567890
  }
}
```

### Anti-Abuse Violation Response
```typescript
{
  success: false,
  error: "Invalid form submission" // Honeypot triggered
}
// or
{
  success: false,
  error: "Submission too fast. Please wait at least 2 seconds."
}
```

## Testing

Comprehensive test coverage includes:
- Rate limiting algorithm validation
- Sliding window behavior
- Honeypot validation
- Submit time validation
- Combined anti-abuse validation
- Error handling
- IP extraction from headers

Run tests with: `npm test tests/rateLimit.test.ts`

## Monitoring

Rate limiting events are automatically logged for monitoring:
- Failed validations include error details
- Rate limit violations include user/IP information
- Configuration errors are logged with context

## Production Considerations

### In-Memory Storage
Current implementation uses in-memory storage suitable for MVP. For production scaling:
- Consider Redis for shared rate limiting across multiple servers
- Implement persistent storage for longer-term abuse tracking
- Add distributed rate limiting for load-balanced deployments

### IP Detection
Currently extracts IPs from common proxy headers:
- `x-forwarded-for`
- `x-real-ip` 
- `cf-connecting-ip` (Cloudflare)
- And others

Ensure your reverse proxy/CDN sets appropriate headers.

### Performance
- Automatic cleanup of expired entries every 5 minutes
- Memory usage scales with number of unique users/IPs
- O(1) rate limit checks
- Minimal impact on request latency

## Security Notes

- Rate limits apply per user+IP combination to prevent abuse
- Honeypot fields use standard anti-bot techniques
- Minimum submit times detect automated submissions
- All validations happen server-side and cannot be bypassed
- Error messages are intentionally vague to prevent information disclosure