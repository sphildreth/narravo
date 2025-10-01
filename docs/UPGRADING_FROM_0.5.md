# Upgrading from 0.5.0 to 0.6.x

## What Changed

Version 0.6.0 and 0.6.1 introduced new database schema changes:

### Migration 0015 (v0.6.0) - 2FA Support
- Added `two_factor_enabled` and `two_factor_enforced_at` columns to `users` table
- Created tables for 2FA: `owner_totp`, `owner_recovery_code`, `owner_webauthn_credential`, `trusted_device`, `security_activity`

### Migration 0016 (v0.6.1) - MFA Verification
- Added `mfa_verified_at` column to `users` table

### Migration 0017 (v0.6.2) - Junction Table Primary Keys
- Added composite primary keys to `post_tags` table
- Added composite primary keys to `comment_tags` table

## Migration Method Change

**Important:** Starting with 0.6.2, production deployments now use `drizzle:migrate` instead of `drizzle:push`.

- ✅ `drizzle:migrate` - Applies migrations sequentially, maintains history, production-safe
- ⚠️ `drizzle:push` - Dev-only tool for quick schema sync, not safe for production

## Upgrade Steps

### 1. Backup Your Database

```bash
# Option 1: Using Narravo's backup tool
pnpm backup

# Option 2: Manual PostgreSQL backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

### 2. Update Code

```bash
git fetch --tags
git checkout v0.6.2  # or main branch
pnpm install
```

### 3. Run Migrations

```bash
pnpm drizzle:migrate
```

This will apply migrations 0015, 0016, and 0017 if they haven't been applied yet.

**Expected output:**
```
🔌 Connecting to database...
🚀 Running migrations from ./drizzle/migrations...
✅ All migrations applied successfully
```

### 4. Verify

Check that new columns exist:

```sql
-- Connect to your database
psql $DATABASE_URL

-- Check users table has 2FA columns
\d users

-- Check junction tables have composite primary keys
\d post_tags
\d comment_tags
```

### 5. Deploy

The `deploy/entrypoint.sh` now automatically runs migrations on container startup:

```bash
# If using Docker
docker-compose up --build

# If using manual deployment
pnpm build
pnpm start  # Migrations run via entrypoint.sh
```

## Troubleshooting

### "Migration failed" Error

If migrations fail, it usually means your database schema is out of sync. Common causes:

1. **You manually modified the database** - Reset to match migration 0014 state
2. **Migrations were partially applied** - Check which migrations have run
3. **Database permissions** - Ensure database user can CREATE/ALTER tables

### Checking Applied Migrations

Drizzle stores migration history in the `__drizzle_migrations` table:

```sql
SELECT * FROM __drizzle_migrations ORDER BY created_at;
```

### Manual Migration Application

If automatic migration fails, you can apply them manually:

```bash
# Apply migrations 0015, 0016, 0017 manually
psql $DATABASE_URL < drizzle/migrations/0015_real_nehzno.sql
psql $DATABASE_URL < drizzle/migrations/0016_rapid_spectrum.sql
psql $DATABASE_URL < drizzle/migrations/0017_tough_prodigy.sql
```

### Junction Tables Have Wrong Schema

If your `post_tags` or `comment_tags` tables have an `id` column (they shouldn't), you need to fix them:

```sql
-- Check current structure
\d post_tags
\d comment_tags

-- If they have 'id' columns, drop them and add composite PKs
BEGIN;

-- Fix post_tags
ALTER TABLE post_tags DROP CONSTRAINT IF EXISTS post_tags_pkey;
ALTER TABLE post_tags DROP COLUMN IF EXISTS id;
ALTER TABLE post_tags ADD CONSTRAINT post_tags_post_id_tag_id_pk 
  PRIMARY KEY (post_id, tag_id);

-- Fix comment_tags  
ALTER TABLE comment_tags DROP CONSTRAINT IF EXISTS comment_tags_pkey;
ALTER TABLE comment_tags DROP COLUMN IF EXISTS id;
ALTER TABLE comment_tags ADD CONSTRAINT comment_tags_comment_id_tag_id_pk 
  PRIMARY KEY (comment_id, tag_id);

COMMIT;
```

### Starting Fresh

If you're having trouble and don't have production data:

```bash
# Drop and recreate database
dropdb narravo
createdb narravo

# Run all migrations from scratch
pnpm drizzle:migrate

# Seed configuration
pnpm seed:config
```

## Development Workflow Going Forward

### Making Schema Changes

```bash
# 1. Edit schema
vim drizzle/schema.ts

# 2. Generate migration
pnpm drizzle:generate

# 3. Review generated SQL
cat drizzle/migrations/00XX_name.sql

# 4. Apply locally (choose one)
pnpm drizzle:migrate  # Production-like (recommended)
pnpm drizzle:push     # Quick dev sync (faster iteration)

# 5. Test
pnpm test
pnpm typecheck

# 6. Commit
git add drizzle/
git commit -m "feat: add new schema change"
```

### Production Deployments

Migrations now run automatically on deployment via `deploy/entrypoint.sh`. No manual intervention needed.

If you prefer manual control, run migrations before starting the app:

```bash
pnpm drizzle:migrate
pnpm start
```

## Summary

- **Backup before upgrading**
- **Run `pnpm drizzle:migrate`** to apply schema changes
- **Migrations are now automatic** in production deployments
- **Use `drizzle:push` only for local development**
- **Check migration status** if issues occur

For detailed migration documentation, see the [Drizzle documentation](https://orm.drizzle.team/kit-docs/overview#running-migrations).
