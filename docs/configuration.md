# Configuration System

Narravo uses a dynamic single-table configuration system that supports typed values, user overrides, caching, and validation.

## Overview

The configuration system provides:
- **Typed configuration values** (string, integer, number, boolean, date, datetime, json)
- **User-specific overrides** for allowlisted keys
- **Validation** with allowed values and type checking
- **Caching** with TTL and Stale-While-Revalidate (SWR)
- **Admin interface** for configuration management
- **API endpoints** for programmatic access

## Architecture

### Database Schema

Configuration is stored in a single `configuration` table:

```sql
CREATE TABLE configuration (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL,                    -- Normalized key (e.g., "SYSTEM.CACHE.DEFAULT-TTL")
  user_id UUID NULL,                    -- NULL = global, non-NULL = user override
  type config_value_type NOT NULL,      -- Enum: string|integer|number|boolean|date|datetime|json
  value JSONB NOT NULL,                 -- The actual value
  allowed_values JSONB NULL,            -- Optional array of allowed values
  required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, user_id)
);
```

### Key Format

Configuration keys follow a strict format:
- **Uppercase** with **dots** as separators
- **Dashes** allowed within segments (no underscores)
- **Regex:** `^[A-Z0-9-]+(\.[A-Z0-9-]+)*$`

Examples:
- ✅ `SYSTEM.CACHE.DEFAULT-TTL`
- ✅ `THEME`
- ✅ `USER.NOTIFICATIONS.EMAIL`
- ❌ `system.cache.ttl` (lowercase)
- ❌ `SYSTEM_CACHE_TTL` (underscores)

## Service Layer

### ConfigService Interface

```typescript
import { ConfigServiceImpl } from '@/lib/config';

// Initialize with optional user allowlist
const allowUserOverrides = new Set(['THEME', 'USER.LANGUAGE', 'USER.TIMEZONE']);
const configService = new ConfigServiceImpl({ 
  db, 
  allowUserOverrides 
});

// Read configuration (prefers user override, falls back to global)
const theme = await configService.getString('THEME', { userId: 'user123' });
const cacheTimeout = await configService.getNumber('SYSTEM.CACHE.DEFAULT-TTL');

// Admin operations (global configuration)
await configService.setGlobal('THEME', 'dark', {
  type: 'string',
  allowedValues: ['light', 'dark', 'system'],
  required: true
});

// User operations (only for allowlisted keys)
await configService.setUserOverride('THEME', 'user123', 'dark');
await configService.deleteUserOverride('THEME', 'user123');

// Check if user overrides are allowed
if (configService.canUserOverride('THEME')) {
  // Allow user to change this setting
}
```

### Caching

The service includes intelligent caching:
- **TTL:** Configurable via `SYSTEM.CACHE.DEFAULT-TTL` (default: 5 minutes)
- **SWR:** 20-minute stale-while-revalidate window
- **Jitter:** ±10% randomization to prevent cache stampedes
- **Single-flight:** Deduplication of concurrent requests

## Admin Interface

Navigate to `/admin/system/configuration` to manage configuration:

### Features
- **Create/Edit/Delete** configuration keys
- **Type validation** with input controls
- **Allowed values** validation
- **Search and filtering** by category
- **Required field** protection (cannot delete required keys)

### Categories
The UI automatically categorizes keys:
- **Site:** General site settings
- **Appearance:** Theme and UI settings  
- **Security:** Authentication and rate limits
- **Posts:** Content and publishing settings
- **Advanced:** Technical and system settings

## API Endpoints

### Admin APIs (require authentication)

```http
# Set global configuration
POST /api/admin/config/global
{
  "key": "THEME",
  "value": "dark",
  "type": "string",
  "allowedValues": ["light", "dark", "system"],
  "required": true
}

# Set user override
POST /api/admin/config/user  
{
  "key": "THEME",
  "userId": "user123",
  "value": "dark"
}

# Delete user override
DELETE /api/admin/config/user
{
  "key": "THEME", 
  "userId": "user123"
}

# Invalidate cache
POST /api/admin/config/invalidate
{
  "key": "THEME",
  "userId": "user123" // optional
}
```

## Common Configuration Keys

### System Settings
- `SYSTEM.CACHE.DEFAULT-TTL` (integer) - Cache timeout in minutes
- `SYSTEM.SITE.NAME` (string) - Site title
- `SYSTEM.SITE.DESCRIPTION` (string) - Site description

### User Preferences (User-Overridable)
- `THEME` (string) - UI theme: light|dark|system
- `USER.LANGUAGE` (string) - Language preference
- `USER.TIMEZONE` (string) - Timezone setting
- `USER.NOTIFICATIONS.EMAIL` (boolean) - Email notifications

### Content Settings
- `COMMENTS.MAX-DEPTH` (integer) - Comment nesting depth
- `COMMENTS.TOP-PAGE-SIZE` (integer) - Comments per page
- `FEED.LATEST-COUNT` (integer) - Items in RSS feed

### Rate Limits
- `RATE.COMMENTS-PER-MINUTE` (integer) - Comment submission limit
- `RATE.REACTIONS-PER-MINUTE` (integer) - Reaction submission limit

### Upload Limits
- `UPLOADS.IMAGE-MAX-BYTES` (integer) - Max image file size
- `UPLOADS.VIDEO-MAX-BYTES` (integer) - Max video file size
- `UPLOADS.ALLOWED-MIME-IMAGE` (json) - Allowed image MIME types

## User Override Permissions

The system supports user-specific configuration overrides with an allowlist system:

```typescript
// Define which keys users can override themselves
const allowUserOverrides = new Set([
  'THEME',
  'USER.LANGUAGE', 
  'USER.TIMEZONE',
  'USER.NOTIFICATIONS.EMAIL'
]);

const configService = new ConfigServiceImpl({ 
  db, 
  allowUserOverrides 
});

// Users can only override allowlisted keys
await configService.setUserOverride('THEME', userId, 'dark'); // ✅ Allowed
await configService.setUserOverride('SYSTEM.CACHE.DEFAULT-TTL', userId, 10); // ❌ Throws error
```

## Validation

The system enforces validation at multiple levels:

### Type Validation
Values must match their declared type:
```typescript
await configService.setGlobal('RATE.COMMENTS-PER-MINUTE', '5', { type: 'integer' }); // ❌ String 
await configService.setGlobal('RATE.COMMENTS-PER-MINUTE', 5, { type: 'integer' }); // ✅ Integer
```

### Allowed Values
When `allowedValues` is set, values must be in the list:
```typescript
await configService.setGlobal('THEME', 'purple', { 
  type: 'string',
  allowedValues: ['light', 'dark', 'system'] 
}); // ❌ Not in allowed list
```

### Required Fields
Required global configuration cannot be deleted:
```typescript
await configService.setGlobal('SYSTEM.SITE.NAME', 'Narravo', { 
  type: 'string', 
  required: true 
});
// Deletion attempts will be rejected
```

## Best Practices

### 1. Use Semantic Key Names
- Group related settings: `USER.NOTIFICATIONS.*`
- Use descriptive names: `CACHE.DEFAULT-TTL` not `CACHE.TTL`
- Follow the category.subcategory.setting pattern

### 2. Set Appropriate Defaults
- Always seed required configuration in migrations
- Choose sensible defaults that work for most users
- Document the purpose and impact of each setting

### 3. Leverage User Overrides Carefully
- Only allow user overrides for true preferences
- Never allow users to override system/security settings
- Consider the UI implications of user-configurable settings

### 4. Monitor Cache Performance
- Set appropriate TTL values (not too short, not too long)
- Use the invalidation API after bulk configuration changes
- Monitor cache hit rates in production

### 5. Validate Input
- Always use `allowedValues` for enums
- Set proper `type` constraints
- Validate ranges in application code for numeric values

## Migration and Seeding

Configuration defaults should be seeded during deployment:

```bash
# Seed default configuration
npm run seed:config
```

The seeding script creates all required configuration with sensible defaults. Custom deployments can modify these values through the admin interface or by customizing the seed script.