# Analytics Implementation

This document describes the privacy-respecting view analytics implementation in Narravo.

## Features

### View Tracking
- Anonymous page view counting
- Session-based deduplication (30-minute window)
- Bot filtering with configurable user-agent patterns
- Do Not Track (DNT) header respect
- IP address hashing for privacy

### Data Collection
- **Minimal metadata**: Only essential information is collected
- **Privacy-first**: IP addresses are hashed with configurable salt
- **Bot filtering**: Configurable patterns to exclude automated traffic
- **Session management**: Client-side session IDs for deduplication

### Analytics Dashboard
- **Post performance**: View counts and sparkline visualizations
- **Trending posts**: Popular content over configurable time periods
- **Admin insights**: Detailed analytics for content creators

## Database Schema

### Tables Added
- `posts.views_total` - Total view count per post
- `post_daily_views` - Daily aggregated view counts with unique visitors
- `post_view_events` - Detailed event log (optional for debugging)

### Configuration
All analytics settings are stored in the configuration system:

- `VIEW.SESSION-WINDOW-MINUTES` (30) - Deduplication window
- `VIEW.TRENDING-DAYS` (7) - Days for trending calculation
- `VIEW.ADMIN-SPARKLINE-DAYS` (30) - Sparkline data range
- `VIEW.REVALIDATE-SECONDS` (60) - Cache revalidation frequency
- `VIEW.COUNT-BOTS` (false) - Whether to count bot traffic
- `VIEW.RESPECT-DNT` (true) - Honor Do Not Track headers
- `RATE.VIEWS-PER-MINUTE` (120) - Rate limiting threshold

## API Endpoints

### POST /api/metrics/view
Records a page view for analytics.

**Request:**
```json
{
  "postId": "uuid",
  "sessionId": "optional-session-id"
}
```

**Response:** 204 No Content

**Headers processed:**
- `DNT: 1` - Respected if `VIEW.RESPECT-DNT` is enabled
- `User-Agent` - For bot detection
- `Referer` - Host/path extraction (no query parameters)
- `Accept-Language` - Primary language extraction
- `X-Forwarded-For` / `X-Real-IP` - For IP-based rate limiting

## Client-Side Implementation

### ViewTracker Component
```tsx
import { ViewTracker } from "@/components/analytics/ViewTracker";

// Add to post pages
<ViewTracker postId={post.id} />
```

The component:
- Uses `navigator.sendBeacon()` with `fetch()` fallback
- Manages session IDs in localStorage
- Handles client-side deduplication
- Respects preview mode (skips tracking)

## Privacy Considerations

### Data Minimization
- Only essential data is collected
- No personal identifiers are stored
- IP addresses are hashed, not stored directly
- User agent strings are processed for bot detection only

### User Rights
- DNT header is respected by default
- No cross-device tracking
- Session data is temporary and pseudonymous
- Users can disable JavaScript to opt out

### GDPR Compliance
- Legitimate interest basis (website analytics)
- Minimal data collection
- No profile building or behavioral targeting
- Data retention follows standard web analytics practices

## Environment Variables

### Required for IP Hashing
```bash
ANALYTICS_IP_SALT=your-random-secret-here
```

If not set, IP addresses are not hashed (stored as null).

## Migration

Run the following commands to apply the analytics schema:

```bash
pnpm drizzle:generate
pnpm drizzle:push
pnpm seed:config
```

## Performance

### Caching Strategy
- Trending posts cached for 60 seconds (configurable)
- View counts cached per request cycle
- Sparkline data cached by post and day range

### Database Optimization
- Efficient upserts for daily aggregates
- Indexes on frequently queried columns
- Configurable data retention policies

### Rate Limiting
- 120 requests per minute per IP (configurable)
- In-memory rate limiting for development
- Production deployments should use Redis or similar

## Monitoring

### Key Metrics
- View count accuracy vs. other analytics tools
- Bot filtering effectiveness
- API response times and error rates
- Cache hit ratios

### Debugging
- Set `VIEW.COUNT-BOTS=true` to include bot traffic
- Check `post_view_events` table for detailed logs
- Monitor rate limiting via HTTP 429 responses

## Future Enhancements

### Planned Features
- Cross-device session correlation (privacy-respecting)
- A/B testing framework
- Conversion tracking for specific goals
- Enhanced bot detection algorithms

### Data Export
- Analytics data export for GDPR compliance
- Integration with external analytics platforms
- Historical data aggregation and archival