# Migration 0013 Fix

## Problem

Migration `0013_curvy_dark_phoenix.sql` was originally only trying to ADD a primary key constraint:

```sql
ALTER TABLE "post_daily_views" ADD CONSTRAINT "post_daily_views_day_post_id_pk" PRIMARY KEY("day","post_id");
```

However, this table already had a primary key created in migration `0004_friendly_master_mold.sql` with a different name:

```sql
CREATE TABLE "post_daily_views" (
	...
	CONSTRAINT "post_daily_views_pkey" PRIMARY KEY("day","post_id")
);
```

This caused CI/CD migrations to fail with error:
```
DrizzleQueryError: Failed query: ALTER TABLE "post_daily_views" ADD CONSTRAINT ...
error: multiple primary keys for table "post_daily_views" are not allowed
```

## Root Cause

Drizzle Kit generates constraint names automatically. Between migration 0004 and 0013:
- Migration 0004 used Drizzle's automatic naming: `post_daily_views_pkey` 
- Later versions of Drizzle Kit use a different naming convention: `post_daily_views_day_post_id_pk`
- When regenerating migrations, Drizzle detected the name mismatch and tried to add the constraint with the new name
- But PostgreSQL doesn't allow a table to have multiple primary keys

## Solution

Updated migration `0013_curvy_dark_phoenix.sql` to properly rename the constraint:

```sql
ALTER TABLE "post_daily_views" DROP CONSTRAINT "post_daily_views_pkey";--> statement-breakpoint
ALTER TABLE "post_daily_views" ADD CONSTRAINT "post_daily_views_day_post_id_pk" PRIMARY KEY("day","post_id");
```

This migration now:
1. Drops the old constraint with the old name
2. Adds the constraint back with the new name expected by later migrations

## Impact

- Migrations 0014-0017 will now run correctly as they expect the constraint name `post_daily_views_day_post_id_pk`
- Fresh database installs will create the table with `post_daily_views_pkey` in migration 0004, then rename it in migration 0013
- Existing databases that haven't run migration 0013 will have the constraint renamed
- Existing databases that already failed on migration 0013 will need to be fixed manually or restored from backup

## Prevention

This issue occurred due to Drizzle Kit changing its constraint naming convention. To prevent similar issues:
- Always test migrations locally before pushing to CI/CD
- Review generated migrations carefully, especially constraint operations
- Consider pinning Drizzle Kit version to avoid naming convention changes
- Use explicit constraint names in schema definitions when possible
