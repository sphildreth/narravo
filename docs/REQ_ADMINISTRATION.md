<!-- SPDX-License-Identifier: Apache-2.0 -->
# Narravo — Administration PRD (MVP)

Version: 1.0

See also: [Admin Wireframes (MVP)](REQ_ADMIN_WIREFRAMES.md)

This document defines the minimum, robust requirements for the Administration area that will be used to operate the site. It aligns to the current data model and utilities:
- DB schema: `drizzle/schema.ts` (posts, comments, users, configuration, reactions, redirects)
- Config service: `lib/config.ts` (typed config, allowed values, overrides, caching)
- Admin access: `lib/admin.ts` (email allowlist)
- Existing routes & helpers: R2 presign for media (`/app/api/r2/sign/route.ts`), theme set (`/app/api/theme/set/route.ts`)

Scope areas:
- Posts
- Comments (Moderation)
- Users
- System → Appearance
- System → Configuration


## 1) Roles & Access
- Role model (MVP): single "Admin" via email allowlist `ADMIN_EMAILS` (comma-separated). Non-admin users cannot access admin routes.
- Auth required for any admin action. Sessions via Auth.js.
- Authorization checks at route + server action boundaries. All destructive actions require CSRF-safe methods and confirmation UI.
- Audit (lightweight): store an in-memory log for now (console/info). Future: persisted audit trail (actorId reserved in `ConfigService`).

Navigation (top-level): Dashboard, Posts, Moderation, Users, System (Appearance, Configuration).


## 2) Posts Management
Data model mapping: `posts(id, slug, title, html, excerpt, publishedAt, createdAt, updatedAt)`.

2.1 List View
- Table columns: Title, Slug, Published, Updated, CommentsCount, ReactionsCount (counts optional for MVP; may be lazy/approx).
- Actions per row: Edit, View (new tab), Unpublish/Publish, Delete.
- Bulk actions: Publish, Unpublish, Delete (with confirmation; show count and any failures).
- Search/filter/sort:
    - Search: by title or slug substring.
    - Filters: Status (Published vs Draft/Unpublished), Date range (created/published), Has comments (optional).
    - Sort: Updated desc (default), Published desc, Title asc.
- Pagination: 20 per page.

2.2 Create/Edit
- Fields: Title (required), Slug (required, unique), Excerpt (optional, up to ~300 chars), Content HTML (required; sanitized), PublishedAt (nullable; when set in future is Published).
- Slug rules: auto-generate from Title on first entry; can edit; enforce uniqueness; show immediate validation.
- Content editing: WYSIWYG/HTML or Markdown-to-HTML pipeline (MVP uses HTML field already sanitized on save with the same allowlist as frontend rendering).
- Preview: open read-only preview using draft data without persisting publish (temporary draft save allowed).
- Save states:
    - Save draft (no PublishedAt)
    - Publish now (sets PublishedAt=now)
    - Schedule (set a future PublishedAt; publish job not required—frontend treats future date as not published; a background job is out-of-scope for MVP—manual publish is acceptable.)
- Validation:
    - Title non-empty; HTML non-empty; slug matches `^[a-z0-9-]+$`.
    - Sanitization: DOMPurify allowlist server-side; strip inline event handlers and disallowed tags.
- Concurrency safety: optimistic update using `updatedAt`; if stale, prompt to reload/merge.

2.3 Delete/Unpublish
- Unpublish: clears PublishedAt; content remains.
- Delete: hard delete post → cascades delete comments (schema already cascades via comments.postId). Confirm with secondary prompt displaying the number of comments that will be removed.
- Cache/ISR: on Publish/Unpublish/Edit/Delete, trigger revalidation for tags `post:{id}`, `home`, `archive:{ym}`.

Acceptance
- Can create, edit, publish/unpublish, and delete posts with proper validation and unique slug handling.
- Search/filter/sort/pagination work and return consistent subsets.
- Sanitization verified; saved HTML renders without XSS issues.
- Revalidation occurs on state-changing actions.


## 3) Comments Moderation
Data model mapping: `comments(id, postId, userId, parentId, path, depth, bodyHtml, bodyMd, status, createdAt)`, `comment_attachments`.

States: `pending | approved | spam | deleted` (default pending).

3.1 Moderation Queues
- Tabs/filters: Pending (default), Approved, Spam, Deleted.
- Table/list columns: Excerpt (first 140 chars), Post (title + link), Author (name/email with avatar), Status, CreatedAt.
- Bulk actions: Approve, Mark as Spam, Delete. Undo (where safe) for a short period.
- Item detail panel: shows full comment, parent context (1 level), attachments preview, actions.

3.2 Actions & Editing
- Approve → status=approved; Spam → status=spam; Delete → status=deleted (soft delete hides content in UI); Hard delete option for admins (removes row and attachments).
- Edit: Allow admin to edit comment body (Markdown and/or HTML). Re-sanitize on save.
- Reply as admin: allowed; replies inherit threading rules (bounded depth as per PRD core; depth ≤ 4).
- Attachments:
    - Show thumbnails (images) and poster for videos (if available).
    - Admin can remove attachments individually.
- Abuse controls (enforced by APIs): rate limits are already in the product; admin UI should display when limits are hit.

3.3 Filters & Search
- Search by text substring, post slug/title, author email, status.
- Date range filter (createdAt).

Acceptance
- Approve/Spam/Delete (soft/hard) work from list and detail views; bulk actions apply atomically where possible.
- Edited comments re-sanitize safely and render correctly.
- Thread context shows parent; attachments can be removed.


## 4) Users
Data model mapping: `users(id, email, name, image)`.

4.1 List & Search
- Table columns: Name, Email, Joined (first-seen, if available via createdAt; if not, show N/A), Comments count (optional), Reactions count (optional).
- Search by name/email substring.

4.2 Details & Admin Controls
- Detail panel shows basic profile info, recent comments (last 10) and reactions (optional).
- Admin flag: surfaced read-only from allowlist; show why a user is admin and which email matched.
- Privacy/GDPR basics:
    - Anonymize user: sets their comments to userId=null (schema already `onDelete: set null`) by deleting the user row after a safety prompt.
    - Export user data (optional post-MVP): JSON of comments/reactions.
- Blocklist (post-MVP): simple boolean to prevent commenting. Not in current schema; document as a next step.

Acceptance
- Admin can locate users via search and view details.
- Admin can anonymize/remove a user safely; comments remain but disassociated.
- Admin visibility into who has admin privileges via allowlist.


## 5) System → Appearance
Purpose: control theme and brand visuals.

5.1 Theme
- Global default theme (light/dark) and brand palette selection. Persist via config key (see Configuration) and `/api/theme/set` for session switching.
- SSR: respect cookie-based theme to avoid FOUC.

5.2 Banner (Hero)
- Manage site-wide banner per PRD core:
    - Fields: image (upload via R2 presigned), alt, (optional) credit text + URL, overlay color (hex) + opacity (0–60%), focal point x/y (0..1).
    - Responsive renditions generated or referenced; ensure alt text present.
    - Preview within the admin before saving.

5.3 Icons/Branding (MVP-lite)
- Upload favicon and logo (optional; if not present, defaults from `/public`).

Acceptance
- Admin can change default theme; cookie/session theme switcher continues to function.
- Admin can upload/update banner settings and see live preview before save.
- Saved settings reflect on public pages after revalidation.


## 6) System → Configuration
Backed by `configuration` table and `ConfigService`.

6.1 Concepts
- Keys are UPPERCASE dot-separated namespaces, e.g., `SITE.NAME`, `SITE.DESCRIPTION`, `THEME.DEFAULT`, `SYSTEM.CACHE.DEFAULT-TTL`.
- Types: `string | integer | number | boolean | date | datetime | json`.
- Values: stored as JSON; validated by type and optional `allowedValues`.
- Scopes: `global` (userId null) with optional per-user overrides (requires existing global type).
- Required: mark global keys as required to enforce presence in UI.

6.2 UI
- List: table of keys with columns Key, Type, Scope (Global/User), Required, UpdatedAt.
- Detail/Edit:
    - Global editor: set value, `allowedValues` (array), and `required` flag. On first insert, type is mandatory and immutable thereafter.
    - Per-user override: set or delete override for a chosen user.
    - Validation: enforce type and allowedValues; show inline errors from service.
- Search by key prefix and filter by type.

6.3 Caching & Invalidation
- `ConfigService` caches values with TTL+SWR; default TTL key `SYSTEM.CACHE.DEFAULT-TTL` (1..1440 minutes).
- UI should expose a manual "Invalidate Cache" for a key and show current effective value for a test user.

Acceptance
- Admin can create/edit global keys (with type), set allowedValues/required, and update values.
- Admin can add/remove per-user overrides where a global type exists.
- Invalid or disallowed values are rejected with clear messaging.
- Cache invalidation works; effective values update within expected TTL or immediately after manual invalidate.


## 7) Non-functional Requirements
- Security: admin routes protected by allowlist; all mutations via server actions/API with CSRF-safe semantics; rate limits on bulk endpoints to avoid abuse.
- A11y: keyboard navigable forms/tables; focus-visible; labels/aria; color contrast AA.
- Performance: tables virtualized or paginated; search/filter server-side; avoid N+1 queries.
- DX/Observability: structured logs for admin actions (at least console for MVP); basic error toasts with retry.


## 8) Data Integrity & Validation Summary
- Posts: enforce unique slug; sanitize HTML; optimistic concurrency using `updatedAt`.
- Comments: sanitize on save; status transitions allowed among pending/approved/spam/deleted; hard delete cascades attachments.
- Users: deleting user sets `userId` to null on comments (anonymization), cascades on reactions.
- Configuration: immutable type per key after first set; `allowedValues` gate; per-user override only if global type exists.


## 9) Minimal API/Integration Notes
- Media uploads: use existing R2 presign endpoint for admin uploads; limit size and mime type; store URLs in attachments or config as needed.
- Theme: use `/api/theme/set` for session cookie; store site default in config key `THEME.DEFAULT` (`"light"|"dark"`).
- Revalidation: invoke Next.js tag revalidation for posts and archives after mutations.


## 10) Acceptance Checklist (End-to-End)
- Posts: CRUD + publish/unpublish + search/filter/sort + revalidation.
- Comments: queues + approve/spam/delete + edit + attachments removal + search/filter.
- Users: list/search + detail + anonymize + admin visibility.
- Appearance: theme default + banner upload/edit + preview + revalidation.
- Configuration: CRUD with types + allowedValues + overrides + cache invalidation.
- Access control: only allowlisted admins can use admin UI; non-admins get 403.


## 11) Out of Scope (MVP) and Next Steps
- Roles beyond single Admin (e.g., Editor/Moderator) — future.
- Full audit log persistence — future.
- Redirects management UI — recommended next: CRUD for `redirects(fromPath, toPath, status)`.
- Backups/Restore UI — future (present in core PRD).
- User blocklist/suspension flag — future (requires schema change).
