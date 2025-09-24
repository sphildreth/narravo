# REQ: Post Locking & Inactive Visibility — v2 (2025-09-24)

## Summary
Introduce two orthogonal controls on **posts**:
- **Locking** prevents edits by any user.
- **Inactive** hides posts from public and default admin listings.

This revision clarifies schema, invariants, UX, permissions, and acceptance criteria, correcting typos and filling gaps.

## Goals
- Allow admins to lock/unlock a post with an optional reason.
- Allow admins to mark a post inactive/active and filter by this state.
- Ensure non‑admins cannot view inactive posts and cannot comment on locked posts.
- Provide auditable metadata (who/when) and consistent UX/API behavior.

## Non‑Goals
- Archival/soft‑delete lifecycle beyond “inactive” (out of scope).
- Versioning/collaboration on lock comments (out of scope).

## Terminology
- **Locked**: Post cannot be edited by any user. Post cannot be commented on by any user.
- **Inactive**: Post is hidden from public views, feeds, and sitemap (admin-visible with affordances).

---

## Data Model Changes

**Table:** `posts`

| Column | Type | Default | Null | Description |
|---|---|---:|:---:|---|
| `is_locked` | boolean | `false` | `NOT NULL` | When true, edits are restricted (see Permissions). |
| `locked_comment` | text | — | NULL | Optional rationale shown to admins. |
| `locked_at` | timestamptz | — | NULL | When locked last. |
| `inactive` | boolean | `false` | `NOT NULL` | When true, post is hidden from non‑admins and public listings. |
| `inactivated_at` | timestamptz | — | NULL | When marked inactive last. |

**Indexes**
- `CREATE INDEX CONCURRENTLY idx_posts_inactive ON posts (inactive);`
- `CREATE INDEX CONCURRENTLY idx_posts_is_locked ON posts (is_locked);`

**Check constraints (optional but recommended)**
- `locked_comment` length <= 2,000 chars.
- If `is_locked = false` and `locked_at IS NULL` (enforced at service layer if RDBMS lacks easy expression checks).

**Migrations**
1. Add columns with defaults:
   ```sql
   ALTER TABLE posts
     ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
     ADD COLUMN locked_comment text NULL,
     ADD COLUMN locked_at timestamptz NULL,
     ADD COLUMN inactive boolean NOT NULL DEFAULT false,
     ADD COLUMN inactivated_at timestamptz NULL;
   ```
2. Backfill: none required (defaults cover existing rows).
3. Create indexes concurrently (on Postgres) outside transaction.
4. Remove DEFAULTs on booleans if you prefer explicit application writes.

---

## Permissions

| Action | Role | Rules |
|---|---|---|
| Edit post | Author/Editor | **Denied** when `is_locked = true`. Admins may override with explicit `posts.lock.override`. |
| Lock/Unlock | Admin | Requires `posts.lock.manage`. Audit timestamps. |
| Mark Active/Inactive | Admin | Requires `posts.active.manage`. |
| View inactive post | Admin | Allowed; show status banners. Non‑admins get 404/placeholder (configurable; see Behavior). |

---

## Backend Behavior

### Query Scopes
- **Public scope**: `WHERE inactive = false`.
- **Admin default scope**: All posts; support filters `?inactive=true/false/any` and `?locked=true/false/any`.
- **Feeds/Sitemap**: Exclude `inactive = true`.

### Write Rules
- **Lock**: Set `is_locked = true`, persist `locked_comment` (optional), `locked_at = now()`.
- **Unlock**: Set `is_locked = false`, `locked_at`; keep `locked_comment` *or* optionally clear (config flag).
- **Inactivate**: Set `inactive = true`, `inactivated_at = now()`.
- **Activate**: Set `inactive = false`,  `inactivated_at`.

### API (illustrative)
- `POST /admin/posts/{id}/lock` → 200 with updated post; body: `{ comment?: string }`.
- `POST /admin/posts/{id}/unlock` → 200.
- `POST /admin/posts/{id}/inactive` → 200.
- `POST /admin/posts/{id}/active` → 200.
- Admin list supports: `/admin/posts?inactive=only|include|exclude&locked=only|include|exclude` and search/sort.

### Errors
- 423 Locked on edit when `is_locked = true` (HTTP semantic match), or 403 if policy prefers authorization framing.
- 404 for non‑admin viewing inactive post (prevents information leak), or 200 with placeholder if you want a friendlier message (see UX choosers).

---

## Frontend / UX

### Admin Posts List
- Add **Filters**: _Inactive_ (Only / Include / Exclude [default Exclude]), _Locked_ (Only / Include / Exclude).
- Add **Badges**: `LOCKED` (icon: padlock), `INACTIVE` (icon: eye‑off). Tooltips show reason/by/when.
- Bulk actions (optional stretch): Lock, Unlock, Mark Inactive, Mark Active.

### Post Detail (Admin)
- Show status banner(s):
    - “🔒 Locked by Alice on 2025‑09‑20 — {comment}”
    - “⚠️ Inactive since 2025‑09‑21”
- **Admin Actions**:
    - **Lock** (opens dialog):
        - Fields: Optional **Reason** (multi‑line, 0–2,000 chars).
        - Buttons: **Save** (primary), **Cancel**.
    - **Unlock** (confirm dialog: “This will allow edits.”).
    - **Mark Inactive** / **Mark Active** (confirm dialogs).

### Post Detail (Non‑Admin)
- If inactive:
    - Option A (privacy‑first): return 404/“Not Found”.
    - Option B (friendly): render placeholder card “This post has been flagged as inactive.”

> Choose Option A by default to avoid leaking existence of hidden content via URLs and to simplify SEO.

### Icons/Visuals
- Use a warning‑tinted padlock for **locked** and an eye‑off/ban-circle for **inactive**. Provide accessible labels and `aria-live` for status changes.

---

## SEO & Distribution
- Exclude inactive posts from: public index/listing pages, RSS/Atom/JSON feeds, and XML sitemaps.
- Add `<meta name="robots" content="noindex">` on any admin-preview page of an inactive post.
- Return 404 for inactive to non‑admins to prevent indexing (preferred).

---

## Telemetry & Audit
- Emit structured events on lock/unlock/activate/inactivate with post id, and reason.
- Keep an audit log table if you need history:
    - `post_state_events(post_id, event, comment, created_at)`.

---

## Edge Cases & Invariants
- Locking does **not** imply Inactive, and vice‑versa.
- Prevent simultaneous requests from racing: wrap state changes in a transaction with row‑level lock.
- Prevent saving drafts/auto‑saves for locked posts (unless override).
- Ensure exports/backups include the new fields.
- Enforce consistent state in caches and invalidate affected keys on change.

---

## Acceptance Criteria (AC)

1. **Schema**: New columns exist with defaults and indexes.
2. **Admin List**: Filtering by Inactive and Locked works as specified.
3. **Admin Detail**: Lock/Unlock/Inactivate/Activate actions present and function.
4. **Non‑Admin View**: Inactive posts are not publicly viewable (404 by default).
5. **Editing**: Locked posts cannot be edited without override; appropriate UX is shown.
6. **Audit**: Events persisted/emitted for each state change.
7. **Feeds/Sitemap**: Inactive posts excluded.
8. **Migration**: Zero downtime; existing posts default to unlocked/active.

---

## Test Plan (Examples)

- **Unit**: service-layer invariants (locking transitions, comment bounds).
- **API**: happy paths and failure cases (403/404/423) for unauthorized users.
- **Integration**: admin list filters, badges, and dialogs; sitemap/feed exclusion.
- **E2E**: lock with reason → attempt edit → see denial; mark inactive → public 404.

---

## Rollback Plan
- If needed, keep columns; simply stop writing/reading and hide UI. Remove indexes later.