<!-- SPDX-License-Identifier: Apache-2.0 -->
# Database Migration Guide

This guide covers how to properly manage database migrations in Narravo and how to recover from common migration issues.

## Overview

Narravo uses [Drizzle ORM](https://orm.drizzle.team/) for database schema management and migrations. Drizzle tracks which migrations have been applied using a special table called `drizzle.__drizzle_migrations`.

## Normal Workflow

### 1. Making Schema Changes

Edit the schema in `drizzle/schema.ts`:

```typescript
export const myNewTable = pgTable("my_new_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // ...
});
```

### 2. Generate Migration

Generate a migration file from your schema changes:

```bash
pnpm drizzle:generate
```

This creates a new SQL file in `drizzle/migrations/` with a unique name like `0018_cool_hero_name.sql`.

### 3. Apply Migration

Apply the migration to your database:

```bash
pnpm drizzle:migrate
```

This runs any unapplied migrations and records them in the `drizzle.__drizzle_migrations` table.

## Important: Push vs Migrate

There are two ways to apply schema changes:

### `drizzle:push` (Development Only)
```bash
pnpm drizzle:push
```

- ⚠️ **Bypasses migration tracking**
- Directly pushes schema changes to the database
- Does NOT create migration files
- Does NOT update `__drizzle_migrations` table
- ✅ Good for: Rapid prototyping in local development
- ❌ Bad for: Production or any database you want to track

### `drizzle:migrate` (Production)
```bash
pnpm drizzle:migrate
```

- ✅ **Properly tracks migrations**
- Applies migration files in order
- Records each migration in `__drizzle_migrations` table
- ✅ Good for: Production, staging, any tracked environment
- ❌ Requires: Migration files to be generated first

## Common Issues and Solutions

### Issue 1: "relation already exists" Error

**Symptom:**
```
❌ Migration failed: error: relation "comment_attachments" already exists
```

**Cause:** The database has tables, but `drizzle.__drizzle_migrations` is empty or out of sync. This typically happens when:
- Migrations were applied via `drizzle:push` instead of `drizzle:migrate`
- The `__drizzle_migrations` table was accidentally cleared
- You're migrating from a different migration system

**Solution:**

1. First, verify the current state:
   ```bash
   pnpm drizzle:check
   ```

2. If confirmed, sync the migration tracking:
   ```bash
   CONFIRM_MIGRATION_SYNC=yes pnpm drizzle:sync
   ```

3. Verify it worked:
   ```bash
   pnpm drizzle:check
   ```

4. Try migrating again:
   ```bash
   pnpm drizzle:migrate
   ```

### Issue 2: Migrations Out of Sync

**Symptom:** Different number of applied migrations between environments.

**Solution:**

1. Check migration status:
   ```bash
   pnpm drizzle:check
   ```

2. Ensure all migration files are committed to git
3. Pull latest migration files
4. Apply missing migrations:
   ```bash
   pnpm drizzle:migrate
   ```

### Issue 3: Manual Schema Changes

**Symptom:** Schema was changed directly in the database (via SQL client).

**Solution:**

1. Never make manual schema changes in tracked environments
2. If you must, update `drizzle/schema.ts` to match
3. Run `pnpm drizzle:generate` to create a migration that reflects the current state
4. The generated migration should be a no-op if schema matches

## Available Commands

### `pnpm drizzle:check`
Check the current migration status and show which migrations have been applied. Use this to debug migration issues.

```bash
pnpm drizzle:check
```

Output shows:
- Migration files in `drizzle/migrations/`
- Applied migrations in database
- Database tables
- Status summary and warnings

### `pnpm drizzle:sync`
Synchronize migration tracking when schema exists but migrations aren't tracked.

```bash
CONFIRM_MIGRATION_SYNC=yes pnpm drizzle:sync
```

⚠️ **Warning:** Only use this when you're sure the database schema matches all migration files.

### `pnpm drizzle:generate`
Generate a new migration file from schema changes.

```bash
pnpm drizzle:generate
```

### `pnpm drizzle:migrate`
Apply pending migrations to the database.

```bash
pnpm drizzle:migrate
```

### `pnpm drizzle:push`
⚠️ Push schema changes directly (development only).

```bash
pnpm drizzle:push
```

## Best Practices

### ✅ DO

1. **Always use `drizzle:migrate` in production**
2. **Commit migration files to git** along with schema changes
3. **Test migrations** on a staging database first
4. **Use `drizzle:check`** to verify state before and after migrations
5. **Keep migrations forward-only** - don't edit old migration files
6. **Backup production database** before applying migrations

### ❌ DON'T

1. **Don't use `drizzle:push` in production**
2. **Don't edit applied migration files** - create new ones instead
3. **Don't manually modify `__drizzle_migrations` table** except via sync script
4. **Don't skip migration generation** - always generate migrations for schema changes
5. **Don't delete migration files** that have been applied to production

## Migration Files

Migration files are stored in `drizzle/migrations/` with structure:

```
drizzle/migrations/
├── 0000_lethal_young_avengers.sql
├── 0001_sweet_daredevil.sql
├── 0002_eager_giant_man.sql
├── ...
└── meta/
    ├── _journal.json          # Migration metadata
    └── 0000_snapshot.json     # Schema snapshots
```

The `_journal.json` file tracks:
- Migration order (idx)
- Unique tags (names)
- Timestamps (when)
- Schema version

## Troubleshooting

### Check Database Connection

```bash
psql $DATABASE_URL -c "SELECT version();"
```

### View Applied Migrations

```bash
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;"
```

### View Database Tables

```bash
psql $DATABASE_URL -c "\dt"
```

### Emergency: Start Fresh (Development Only)

⚠️ **This will DELETE ALL DATA**

```bash
# Drop all tables
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Clear Drizzle tracking
psql $DATABASE_URL -c "DROP SCHEMA drizzle CASCADE; CREATE SCHEMA drizzle;"

# Apply all migrations fresh
pnpm drizzle:migrate
```

## Support

If you encounter migration issues:

1. Run `pnpm drizzle:check` and save the output
2. Check the `drizzle/migrations/meta/_journal.json` file
3. Verify your `DATABASE_URL` is correct
4. Check PostgreSQL logs for detailed error messages
5. Open an issue with the above information

## See Also

- [Drizzle ORM Migrations Documentation](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Development Guide](./DEVELOPMENT.md#database)
