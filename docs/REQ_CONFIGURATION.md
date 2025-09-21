<!-- SPDX-License-Identifier: Apache-2.0 -->
# Overview

One-table configuration store with typed values, optional per-user overrides, optional allowed values, and required/global defaults managed in Admin.

# Goal

A dynamic single table for all configuration options. Each option is addressed by a normalized key and stores a typed value, with optional allowed values, and optional per-user overrides. Defaults live in the table (not in code).

# Key naming

- Keys are dot-separated and uppercased for consistency (e.g., SYSTEM.SITE.NAME, THEME).
- Do not store a separate Category column; derive category (e.g., SYSTEM, USER) from the key prefix if needed.
- Normalize keys at write time to a single canonical format (e.g., uppercase with dots, no spaces).
- Do not use underscores in keys; use dashes instead (e.g., SYSTEM.CACHE.DEFAULT-TTL).
- Key segments: [A-Z0-9-]+; segments separated by dots. Example regex: ^[A-Z0-9-]+(\.[A-Z0-9-]+)*$.

# Schema

- id: uuid (pk)
- key: text (not null) – normalized (e.g., UPPERCASE.DOT)
- user_id: uuid (nullable, fk users.id) – null means system/global; non-null is a per-user override
- type: enum [string, integer, number, boolean, date, datetime, json] (not null)
- value: jsonb (not null) – stored in its natural JSON type; validated to match "type"
- allowed_values: jsonb (nullable) – array; each entry must match "type" if present
- required: boolean (not null default false) – applies only to the system/global row (user_id is null)
- created_at, updated_at: timestamptz (not null; updated_at auto-updates)
- optional (derived): category = split_part(key, '.', 1) if you want to index/filter by category

## Constraints

- unique(key, user_id) – prevents duplicate per-user overrides (user_id non-null)
- unique index on key where user_id is null – enforces one global value per key (PostgreSQL partial unique index)
- check: required implies user_id is null (required only on global rows)
- check: allowed_values is null OR jsonb_typeof(allowed_values) = 'array'
- check: value JSON type aligns with "type" (enforce in app; optional DB checks/triggers)
- indexes: (key, user_id); optionally (category) if you materialize it

Note: Because partial unique indexes can't be referenced directly by ON CONFLICT, use the UPDATE-then-INSERT pattern (shown below) when upserting global rows.

# Semantics

- Effective value lookup: for a given key and optional user_id, prefer the per-user row if present; otherwise fall back to the global row.
  - Behavior if no rows exist: treat as missing (caller decides) unless the key is required; required keys should be seeded and non-deletable.
- Required (global) rows:
  - Must exist (seeded via migration/script).
  - Cannot be deleted; attempts should be rejected.
- Allowed values:
  - If allowed_values exists, any new/updated value must be a member (same JSON type).
- Type validation:
  - The stored JSON type must match the declared "type" (e.g., boolean => true/false, integer => JSON number with no fractional part, date/datetime => ISO8601 string).
- Deletion:
  - Deleting a user override reverts to the global value.
  - Deleting a required global row is not allowed.

# Permissions

- Admins can create/update/delete system/global rows (except cannot delete required=true rows).
- Users can create/update/delete their own user-scoped rows only for keys that are explicitly user-overridable.
- Maintain an allowlist of keys that permit user overrides (enforced in the app/service layer).

# System configuration (Admin UI)

Admin screens group related keys (e.g., SYSTEM.SITE.*) and write to the configuration table. UI should enforce allowed values and type input controls.

# Default values

Defaults are data, not code: seed required global rows in migrations/seed scripts. Avoid hard-coded defaults in application code.

Seed the default cache TTL key:
- key: SYSTEM.CACHE.DEFAULT-TTL (global)
- type: integer (minutes)
- value: 5 (5 minutes)

# Caching

To avoid configuration becoming an I/O bottleneck on higher-volume sites, cache effective configuration values.

## Goals

- Reduce read I/O to the database for hot keys.
- Maintain predictable freshness with simple, safe invalidation.
- Prevent cache stampedes and thundering-herd effects.

## What to cache

- Effective values, keyed by (key, user_id|null). This matches the lookup semantics (user override else global).
- Optionally, group-level reads (e.g., all SYSTEM.SITE.*) can be cached if you have list UIs, but prefer per-key caching for simplicity.

## Recommended defaults

- Default TTL (time-to-live): read from configuration key SYSTEM.CACHE.DEFAULT-TTL (integer minutes); seeded default 5.
- Stale-While-Revalidate (SWR) window: 20 minutes. Serve stale if within SWR while refreshing asynchronously.
- Jitter: ±10% randomization of TTL to avoid synchronized expirations.
- Size bound: if using in-memory cache, use an LRU with a sensible cap (e.g., 1–5k entries) depending on footprint.

These defaults provide a good balance: most requests read from cache; edits propagate quickly; and rare misses refresh within the TTL period (e.g., 5 minutes).

## Invalidation

- On update/delete of a key, invalidate both the global entry (key, null) and any known user-specific entries (key, user_id) in the local in-memory cache.
- Multi-instance (MVP): there is no cross-process invalidation. Accept eventual consistency across instances and rely on short TTL/SWR. If stronger consistency is needed later, add a shared pub/sub to broadcast invalidations.
- For bulk changes (e.g., allowed_values or type change), invalidate the global entry and allow overrides to age out via TTL/SWR.

## Stampede protection

- Single-flight: de-duplicate concurrent loads for the same cache key using an in-flight promise map.
- Soft errors: within the SWR window, if the DB read fails, continue serving stale and retry on next access (with backoff).

## Consistency and overrides

- Admin UIs should bypass cache or force-refresh after writes so changes are visible immediately.
- Environment variable overrides (if enabled) should be read first and can also be cached under the same cache key to avoid repeated env parsing.

## Implementation sketch

- Cache key: `config:${KEY}:${USER_ID || 'global'}` where KEY is normalized.
- Read path:
  1) If cache entry exists and fresh (within TTL), return it.
  2) If stale but within SWR, return stale and trigger background refresh (single-flight).
  3) Otherwise, read from DB and set cache with new TTL (with jitter).
- Write path:
  - After a successful DB write, evict affected cache keys in the local cache.

# Configuration service

Encapsulate all configuration domain operations behind a single service that hides storage, validation, permissions, and cache details.

## Responsibilities

- Normalize and validate keys (regex and case), and enforce naming rules.
- Retrieve effective values with user override fallback to global.
- Provide typed getters (string, number/integer, boolean, json) and a generic getter.
- Create/update global values (admin), including type/allowed_values/required semantics.
- Create/update/delete user overrides for allowed keys only.
- Enforce validation (type match, allowed_values membership, required global keys non-deletable).
- Integrate caching (TTL from SYSTEM.CACHE.DEFAULT-TTL in minutes, SWR 20m, jitter, single-flight) and perform local invalidation on writes.

## Public API (TypeScript-ish)

```ts
export type ConfigType = 'string' | 'integer' | 'number' | 'boolean' | 'date' | 'datetime' | 'json';

export interface GetOptions {
  userId?: string | null;
  bypassCache?: boolean; // for Admin flows
}

export interface SetGlobalOptions {
  type?: ConfigType; // required on first insert
  allowedValues?: unknown[] | null;
  required?: boolean;
  actorId?: string; // optional audit
}

export interface SetUserOptions {
  actorId?: string; // optional audit
}

export interface ConfigService {
  // Read effective value (user override else global). Returns null if not found.
  get<T = unknown>(key: string, opts?: GetOptions): Promise<T | null>;

  // Typed conveniences (perform type checks/coercion as appropriate)
  getString(key: string, opts?: GetOptions): Promise<string | null>;
  getNumber(key: string, opts?: GetOptions): Promise<number | null>; // integers and numbers
  getBoolean(key: string, opts?: GetOptions): Promise<boolean | null>;
  getJSON<T = unknown>(key: string, opts?: GetOptions): Promise<T | null>;

  // Admin/global writes
  setGlobal(key: string, value: unknown, opts: SetGlobalOptions): Promise<void>;

  // User overrides (for allowlisted keys only)
  setUserOverride(key: string, userId: string, value: unknown, opts?: SetUserOptions): Promise<void>;
  deleteUserOverride(key: string, userId: string, opts?: SetUserOptions): Promise<void>;

  // Cache controls
  invalidate(key: string, userId?: string | null | '*'): Promise<void>;
}
```

## Behavioral guarantees

- Key normalization: keys are uppercased, dash-allowed, dot-separated; validated against ^[A-Z0-9-]+(\.[A-Z0-9-]+)*$.
- Fallback: get() prefers userId match; else global; else null. For required globals, missing values should be prevented via seeding and guarded on deletion.
- Validation on writes: value JSON type matches declared type; if allowed_values exists, value must be a member; cannot delete required global.
- Permissions: only admins can call setGlobal; users can only set/delete overrides for themselves and for allowlisted keys.

## Cache integration (MVP)

- Reads use cache with TTL from SYSTEM.CACHE.DEFAULT-TTL (integer minutes; default 5), SWR 20 minutes, jitter ±10%.
- Writes: on success, invalidate affected keys in the local in-memory cache only (no cross-process invalidation).
- Admin flows should call get() with `bypassCache: true` or force-refresh after writes.

## Minimal implementation sketch

```ts
class ConfigServiceImpl implements ConfigService {
  constructor(private db: Db, private cache: Cache, private opts: { allowUserOverrides?: Set<string> } = {}) {}

  private normalizeKey(key: string) { /* uppercase, validate regex; throw if invalid */ }
  private async getTtlMinutes(): Promise<number> { /* read SYSTEM.CACHE.DEFAULT-TTL (minutes), bounds [1,1440], default 5 */ }
  private cacheKey(key: string, userId?: string | null) { return `config:${key}:${userId ?? 'global'}`; }

  async get<T = unknown>(key: string, opts?: GetOptions): Promise<T | null> { /* read-through cache with TTL/SWR */ }
  async setGlobal(key: string, value: unknown, opts: SetGlobalOptions): Promise<void> { /* validate + upsert + local invalidate */ }
  async setUserOverride(key: string, userId: string, value: unknown): Promise<void> { /* validate + upsert + local invalidate */ }
  async deleteUserOverride(key: string, userId: string): Promise<void> { /* delete + local invalidate */ }
  async invalidate(key: string, userId?: string | null | '*') { /* local evict */ }
}
```

Usage example (server):

```ts
// Read effective theme for current user
const theme = await configService.getString('THEME', { userId: session?.user.id });

// Admin updates global site title and makes it required
await configService.setGlobal('SYSTEM.SITE.NAME', 'Narravo', { type: 'string', required: true, actorId: adminId });

// User sets their theme override
await configService.setUserOverride('THEME', userId, 'dark');
```

# Examples

- THEME
  - key: THEME
  - type: string
  - allowed_values: ["light", "dark", "system"]
  - global default: value = "light", required = true
  - per-user override: user_id specific value, e.g., "dark"
- SYSTEM.SITE.NAME
  - key: SYSTEM.SITE.NAME
  - type: string
  - required = true; global value like "Narravo"
- SYSTEM.CACHE.DEFAULT-TTL
  - key: SYSTEM.CACHE.DEFAULT-TTL
  - type: integer (minutes)
  - global default: value = 5 (5 minutes)

# Example queries (PostgreSQL)

- Get effective value for a key (prefer user, else global):

```sql
-- $1 = key (text), $2 = user_id (uuid or null)
select value
from configuration
where key = $1 and (user_id = $2 or user_id is null)
order by (user_id is null) asc -- prefer user row
limit 1;
```

- Upsert global value (admin) — UPDATE then INSERT to cooperate with partial unique index on (key) where user_id is null:

```sql
with upsert as (
  update configuration
     set type = $2,
         value = $3::jsonb,
         allowed_values = $4::jsonb,
         required = coalesce($5, false),
         updated_at = now()
   where key = $1
     and user_id is null
 returning 1
)
insert into configuration (key, user_id, type, value, allowed_values, required)
select $1, null, $2, $3::jsonb, $4::jsonb, coalesce($5, false)
where not exists (select 1 from upsert);
```

- Upsert user override (allowed keys only):

```sql
insert into configuration (key, user_id, type, value)
values ($1, $2, $3, $4::jsonb)
on conflict (key, user_id)
do update set value = excluded.value,
              updated_at = now();
```

- Delete user override (fallback to global):

```sql
delete from configuration where key = $1 and user_id = $2;
```

# Reference DDL (PostgreSQL)

```sql
-- Optional: type enum; you can also use text + CHECKs instead
do $$ begin
  if not exists (select 1 from pg_type where typname = 'config_value_type') then
    create type config_value_type as enum (
      'string','integer','number','boolean','date','datetime','json'
    );
  end if;
end $$;

create table if not exists configuration (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  user_id uuid null references users(id) on delete cascade,
  type config_value_type not null,
  value jsonb not null,
  allowed_values jsonb null,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint configuration_key_user_uniq unique (key, user_id),
  constraint configuration_required_global_chk check (
    required = false or user_id is null
  ),
  constraint configuration_allowed_values_array_chk check (
    allowed_values is null or jsonb_typeof(allowed_values) = 'array'
  )
);

-- Enforce single global row per key (NULL user_id) via partial unique index
create unique index if not exists configuration_global_key_uniq
  on configuration (key)
  where user_id is null;

-- Keep keys normalized (uppercase with dots). Enforce in app or via trigger if desired.
create index if not exists configuration_key_user_idx on configuration (key, user_id);

-- Auto-update updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger configuration_set_updated_at
before update on configuration
for each row execute function set_updated_at();
```

# Notes for implementation

- Normalize keys at write.
- Validate type and allowed_values membership on writes in the service layer.
- Seed required global keys in a migration or seed script; block deletion of required=true.
- Cache frequently-read keys with the recommended defaults; bypass or force-refresh in Admin flows; use pub/sub invalidation for multi-instance.
- Read the default TTL from SYSTEM.CACHE.DEFAULT-TTL (integer, minutes); enforce sane bounds (e.g., 1–1440 minutes) and fall back to 5 if missing/invalid.
