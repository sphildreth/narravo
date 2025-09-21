# Overview 

This document specifies how posts should be viewed in the application.

# Index View

The index view is the main view for the application.
- It should show a list of all posts using the post "list" view.
- It should be accessible to all users (no authentication required).
- Posts should be sorted by date (newest first).
- Posts should be displayed with an initial page of FEED.LATEST-COUNT posts and infinite scroll to load more posts.
- Posts should be clickable to view the full post.
- Post tags should be clickable to view all posts with the same tag.
- Post category should be clickable to view all posts with the same category.

Routes
- List (home): `/`
- Detail: `/(public)/[slug]` (e.g., `/<slug>`)
- Admin posts list: `/admin/posts`

# Post Views

There are two primary views:

* List
  - This is the view used in the index to show a post in an abridged form.
  - This view includes these details:
    - Post Category (example: "3DPRINTING").
    - Post Title (example: "OVERTURE PETG").
    - Post Date (example: "2025-09-21").
    - Action to view the full post.
    - Action to leave a comment (loads detail view and sets focus on the comment form).
    - Action (if admin) to edit the post (directs to admin post edit page).
    - A collection of tags for the post that are clickable to show all other posts with the same tag (example: "ADVENTURER5M", "FILAMENT", "PETG").

* Detail
  - This is the view used to show the full post in full detail.
  - It should be accessible to all users (no authentication required).
  - This view includes all the details of the list view and these additional details:
    - Action to delete the post (if admin).
    - Form to leave a comment (if authenticated).
    - If not the first post then a link to the previous post.
    - If not the last post then a link to the next post.
    - A collection of tags for the post that are clickable to show all other posts with the same tag (example: "ADVENTURER5M", "FILAMENT", "PETG").
    - A collection of comments for the post.

---

Implementation notes (current status vs. requirements)
- Home list implementation (app/page.tsx): uses `listPosts({ limit: FEED.LATEST-COUNT })` and caches with the `"home"` tag and configurable revalidate seconds. Infinite scroll is not yet implemented on the page; `lib/posts.ts` supports cursor-based pagination (`nextCursor`) for future infinite scroll.
- List card (components/ArticleCard.tsx): shows date, title, optional excerpt, and links to the detail page. It does not yet render tags, category, or a dedicated "Comment" CTA.
- Detail page (app/(public)/[slug]/page.tsx): renders title, date, excerpt, sanitized HTML, reactions, and a comments section. It does not yet implement previous/next post navigation, tags/category chips, or an admin delete action.
- Admin posts (app/(admin)/admin/posts/page.tsx): provides a table with a "View" link. There is no dedicated edit page route yet.
- Data model (drizzle/schema.ts): `posts` currently do not have tags or categories. If tags/categories are required for navigation and filtering, add appropriate tables (e.g., `post_tags` join table) or fields and routes (e.g., `/tags/[tag]`, `/categories/[slug]`).

Acceptance criteria
- List view
  - Sorted by `publishedAt` descending; drafts/unpublished entries (null `publishedAt`) appear last or are excluded per policy.
  - Initial render shows FEED.LATEST-COUNT posts (config driven if missing default to 10). Infinite scroll loads the next page using a stable cursor (`publishedAt`, `id`).
  - Each card links to the detail page and includes accessible titles and dates; optional excerpt is truncated.
  - Tags and category (when implemented) are rendered as links to their respective filtered views.
  - Admin-only "Edit" action is hidden from non-admins.
- Detail view
  - Renders sanitized post content with proper typography and heading hierarchy.
  - Shows comments list and an authenticated-only comment form; unauthenticated users see a login prompt.
  - Provides Previous/Next links based on `publishedAt` (excluding drafts) when neighbors exist.
  - Admin-only "Delete" action requires confirmation and revalidates the home/tag caches after success.
  - Optional deep link `?comment=1` (or `#comment`) focuses the comment form on load.
- Caching & revalidation
  - Home/list uses ISR with configurable `revalidate` and cache tag `home`.
  - Post mutations (create/update/delete, and comment mutations) trigger `revalidateTag("home")` and any relevant archive/tag pages when those exist.
- Accessibility
  - Cards and actions have descriptive accessible names; the comment form is focusable and labeled.
  - Maintain a proper heading hierarchy (h1 for detail title, h2 for list item titles).

Notes & next steps
- Define and implement tags/categories data model and routes, or adjust the requirements to remove those features.
- Add Previous/Next and admin delete actions on the detail page via Server Components/Actions with Auth.js session checks and CSRF.
- Implement infinite scroll on the home page using the existing cursor shape from `listPosts`.
- Add tests for pagination, prev/next selection logic, and cache revalidation triggers.

---

## Implementation guide

This section details what is needed to implement missing parts in a way that aligns with our stack (Next.js App Router, Drizzle ORM, Zod, Auth.js) and caching strategy.

### 1) Tags and category navigation (incl. managing tags on a comment)

Data model
- tags (new): id (uuid, pk), name (text, unique, case-insensitive), slug (text, unique), createdAt (timestamptz)
- post_tags (new): postId (uuid fk -> posts.id, cascade), tagId (uuid fk -> tags.id, cascade), unique(postId, tagId), indexes on postId and tagId
- categories (new) or posts.categoryId (optional): Prefer a categories table with id, name, slug, createdAt; add posts.categoryId fk -> categories.id (nullable)
- comment_tags (new): commentId (uuid fk -> comments.id, cascade), tagId (uuid fk -> tags.id, cascade), unique(commentId, tagId)

Routing & pages
- /tags/[slug]: List posts for the tag; paginated with the same cursor shape as listPosts; renders ArticleCard list
- /categories/[slug]: List posts for the category; paginated likewise
- Optional admin index pages: /admin/tags and /admin/categories for management

APIs & actions
- GET /api/tags/[slug]/posts?cursor=...&limit=... → { items, nextCursor }; ISR-friendly (see section 2)
- GET /api/categories/[slug]/posts?cursor=...&limit=... → { items, nextCursor }
- Admin: POST /api/admin/comments/[id]/tags { tag: string } to add; DELETE /api/admin/comments/[id]/tags { tag: string } to remove
  - Validate with Zod; require admin session; rate-limit; normalize tag name → slug
  - Creation flow for unknown tags: upsert tags by slug

UI integration
- List and Detail: render tag chips linking to /tags/[slug]; render category chip linking to /categories/[slug]
- Comment tag management (admin-only): in Moderation views, show a compact editor to add/remove chips; debounce and optimistic update

Caching & revalidation
- Tag pages: use revalidateTag(`term:${tagId}`) on post/comment tag mutations
- Category pages: revalidateTag(`term:${categoryId}`) on post mutations
- Also revalidateTag("home") when tags/categories affect post visibility on the home list

Testing
- DB: unique constraints work (no duplicates), case-insensitive matching of tag names
- API: lists filter correctly; pagination cursor works; permissions enforced for comment tag changes
- UI: clicking chips navigates and filters; admin can add/remove tags on comments

Acceptance criteria
- Users can navigate via tag and category chips to filtered, paginated lists
- Admins can add/remove tags on comments; unauthorized users cannot
- Revalidation updates home and term pages after mutations

### 2) Client-side loader + ISR-friendly API/Server Action

API route (recommended for client fetching)
- Create /api/posts/list (GET) that proxies listPosts with cursor support
  - Inputs (query): limit (1..50), cursor.publishedAt (ISO), cursor.id (uuid); validate with Zod
  - Output: { items: PostDTO[], nextCursor: { publishedAt: string, id: string } | null }
  - Caching: configure to be cacheable and tag with "home" (or term tags when filtering); set revalidate to the same value as the page

Server Action (optional for progressive enhancement)
- Expose a server action listMorePosts(formData) that returns the same shape
  - Use when enhancing a Server Component + form-based progressive enhancement

Minimal "Load more" button pattern
- Render initial N posts on the Server Component (home)
- Add a small Client Component that receives initial nextCursor; on click, fetch /api/posts/list with the cursor and append items
- Disable button while loading; handle no more results gracefully; preserve focus and announce updates (a11y)

Progressive enhancement to infinite scroll
- Replace the button with an IntersectionObserver that triggers when a sentinel enters the viewport
- Keep the button as a fallback for non-intersection environments to preserve accessibility

Edge cases & a11y
- Avoid duplicate fetches by tracking in-flight cursor
- Handle stale cursors (return empty page) and show retry
- Ensure focus remains predictable; announce "Loaded X more posts" via aria-live

Acceptance criteria
- "Load more" fetches the next page and appends without full page reload
- Infinite scroll can be enabled without changing the API surface
- ISR-compatible: revalidation updates the API responses; new posts appear on subsequent loads

### 3) Previous/Next links on detail

Selection logic
- Given current post P with publishedAt (non-null):
  - Previous (older): where published_at < P.published_at OR (published_at = P.published_at AND id < P.id); order by published_at desc nulls last, id desc limit 1
  - Next (newer): where published_at > P.published_at OR (published_at = P.published_at AND id > P.id); order by published_at asc nulls last, id asc limit 1
- Exclude drafts/unpublished posts (published_at is null)
- Deterministic tie-breaker on id ensures consistent navigation

UI
- Show links conditionally only when neighbors exist
- Accessible labels: "Previous: {title}" and "Next: {title}"; place at the end of the article content

Caching & revalidation
- Same caching as the detail page; no special handling needed beyond standard post revalidation

Testing
- Boundary conditions: first/last post; identical timestamps; drafts excluded
- Links navigate to correct neighbors

Acceptance criteria
- Detail page renders Previous/Next when appropriate based on publishedAt with tie-breakers

### 4) Admin edit/delete

Edit
- Route: /admin/posts/[id]/edit (new page)
  - Displays title, slug, excerpt, body editor (server-rendered with client editor where needed)
  - Auth: admin-only via server check; hide links for non-admins

Delete (Server Action)
- Provide a server action deletePost(formData) or deletePost(id: string)
  - Validate: Zod schema; require admin session; optional CSRF token
  - Behavior: delete by id; on success revalidateTag("home"), revalidatePath("/"); also revalidate term tags impacted by this post (tag/category pages)
  - UI: show a confirm dialog; optimistic disable; error message on failure

Security
- Enforce admin policy using ADMIN_EMAILS or a role check on every admin route/action
- Log admin deletes server-side without exposing sensitive info to the client

Testing
- Unit: delete action guards and revalidation
- Integration: admin can delete; non-admin cannot

Acceptance criteria
- Admin-only edit route exists; delete button calls a server action with confirmation and revalidation

### 5) Not-found handling

Behavior
- Use notFound() in app/(public)/[slug]/page.tsx when a post is missing
- Add app/(public)/[slug]/not-found.tsx to render a friendly message and a link back to home

Acceptance criteria
- Unknown slug navigates to the not-found UI (not a generic inline message)
- Page returns 404 status in production

---

## Agent implementation slices (small, self-contained)

Each slice lists minimal touchpoints to keep agent context small. Follow AGENTS.md guardrails and task templates.

S-01: Not-found handling for post detail
- Summary: Return 404 with friendly UI for unknown slugs.
- Touchpoints: app/(public)/[slug]/page.tsx, app/(public)/[slug]/not-found.tsx (new)
- Steps:
  1) In page.tsx, when post is not found, call `notFound()` from next/navigation.
  2) Add not-found.tsx rendering a short message and a link back to `/`.
- Acceptance:
  - Visiting a non-existent slug shows not-found UI and returns 404 in prod.
- Tests:
  - Unit: none required. Optional e2e later.

S-02: API — list posts with cursor
- Summary: Expose GET /api/posts/list mirroring `listPosts` with cursor, Zod-validated inputs.
- Touchpoints: app/api/posts/list/route.ts (new), lib/posts.ts (read-only)
- Steps:
  1) Parse query: `limit`, `cursor.publishedAt`, `cursor.id` with Zod.
  2) Call `listPosts` and return `{ items, nextCursor }` JSON.
  3) Tag response with `home` and revalidate per config (align to home page value).
- Acceptance:
  - Valid requests return 200 with items and optional nextCursor; invalid parameters → 400.
- Tests:
  - Unit: Zod schema happy/invalid.

S-03: Client “Load more” button for home
- Summary: Progressive enhancement for pagination without full reload.
- Touchpoints: components/LoadMore.tsx (new, client), app/page.tsx (integrate)
- Steps:
  1) Client component accepts initial `nextCursor` and appends fetched items.
  2) Fetch from `/api/posts/list` with cursor; disable button while loading.
  3) Announce updates via aria-live; keep focus predictable.
- Acceptance:
  - Clicking “Load more” appends posts; disabled at end; no duplicates.
- Tests:
  - Component test: renders, disables on load, appends mock items.

S-04: Infinite scroll enhancement (optional)
- Summary: IntersectionObserver to trigger auto-load.
- Touchpoints: components/LoadMore.tsx (extend)
- Steps:
  1) Add sentinel div; observe visibility to trigger fetch.
  2) Keep button fallback for accessibility.
- Acceptance:
  - Auto-loads when sentinel visible; button still works.
- Tests:
  - Component test: observer callback triggers fetch once per cursor.

S-05: Prev/Next neighbor selection (data)
- Summary: Provide deterministic neighbor lookup by publishedAt/id.
- Touchpoints: lib/posts.ts (new exported functions), tests/posts.test.ts (add cases)
- Steps:
  1) Implement `getPreviousPost(id)` and `getNextPost(id)` using SQL with tie-breaker on id and excluding null publishedAt.
  2) Export for use by the detail page.
- Acceptance:
  - Returns correct neighbors or null at boundaries.
- Tests:
  - Unit: tie timestamp, first/last, drafts excluded.

S-06: Prev/Next UI on detail
- Summary: Render conditional links at the bottom of the article.
- Touchpoints: app/(public)/[slug]/page.tsx
- Steps:
  1) Call neighbor functions and render links if present.
  2) Labels: “Previous: {title}”, “Next: {title}”.
- Acceptance:
  - Links appear only when neighbors exist and navigate correctly.
- Tests:
  - Component-level test with mocked neighbors (optional).

S-07: Admin delete — Server Action
- Summary: Securely delete a post and revalidate caches.
- Touchpoints: app/(admin)/admin/posts/actions.ts (new), lib/db.ts, lib/auth.ts
- Steps:
  1) Zod-validate input; check admin via session; optional CSRF.
  2) Delete by id; on success call `revalidateTag("home")` and `revalidatePath("/")`.
- Acceptance:
  - Non-admin rejected; admin can delete; caches revalidated.
- Tests:
  - Unit: guard + happy path; spy on revalidation.

S-08: Admin delete — UI on detail
- Summary: Button for admins only, with confirm and optimistic disable.
- Touchpoints: app/(public)/[slug]/page.tsx (minimal), components (optional small ConfirmButton)
- Steps:
  1) Detect admin in Server Component (session); render button.
  2) On submit, call Server Action; on success navigate to `/`.
- Acceptance:
  - Button not visible to non-admins; delete flows end-to-end.
- Tests:
  - Rendering gated by admin; action called on confirm (mocked).

S-09: Tags — DB migration and types
- Summary: Introduce `tags` and `post_tags` tables.
- Touchpoints: drizzle/migrations/* (new), drizzle/schema.ts, src/types (if needed)
- Steps:
  1) Create tables with uniques and indexes; add minimal types.
  2) Backfill script optional (no-op if greenfield).
- Acceptance:
  - Migrations apply; unique(postId, tagId) enforced.
- Tests:
  - Migration smoke; insert dupe fails.

S-10: Tag list API and page
- Summary: Filtered, paginated tag archive.
- Touchpoints: app/api/tags/[slug]/posts/route.ts (new), app/tags/[slug]/page.tsx (new), lib/db.ts
- Steps:
  1) API validates slug and cursor; returns items/nextCursor.
  2) Page renders ArticleCard list using Server Component.
- Acceptance:
  - Clicking a tag chip shows the filtered list; pagination works.
- Tests:
  - API validation; page renders empty state.

S-11: Render tag chips on detail
- Summary: Show tags for a post and link to /tags/[slug].
- Touchpoints: lib/posts.ts (extend query), app/(public)/[slug]/page.tsx (render chips)
- Steps:
  1) Include tags in post query (join post_tags→tags).
  2) Render chips with accessible labels.
- Acceptance:
  - Chips link to tag pages; safe when no tags.
- Tests:
  - Rendering with/without tags.

S-12: Comment tag management — backend
- Summary: Admin endpoints to add/remove tags on comments.
- Touchpoints: app/api/admin/comments/[id]/tags/route.ts (new), lib/auth.ts, lib/db.ts
- Steps:
  1) POST/DELETE with Zod, admin check, rate limit.
  2) Upsert tag on add; update comment_tags; revalidate term/home as needed.
- Acceptance:
  - Only admins can modify; consistent tag slugs.
- Tests:
  - Permission enforced; add/remove idempotent.

S-13: Comment tag management — UI
- Summary: Chip editor in moderation queue for admins.
- Touchpoints: components/admin/ModerationQueue.tsx
- Steps:
  1) Add small chip input to call admin APIs.
  2) Optimistic add/remove with error fallback.
- Acceptance:
  - Admin can add/remove; state reflects server.
- Tests:
  - Component test with mocked API.

S-14: Categories (optional) — DB, page, chips
- Summary: Categories table and category archive page.
- Touchpoints: drizzle/migrations/* (new), drizzle/schema.ts, app/categories/[slug]/page.tsx (new), lib/posts.ts (optional), UI chips
- Steps:
  1) Add `categories` and posts.categoryId; unique slug.
  2) Category list page and chip rendering similar to tags.
- Acceptance:
  - Category navigation mirrors tags behavior.
- Tests:
  - Similar to tag tests.

S-15: Visual layout and theming (image-free spec)
- Summary: Implement layout and theming using design tokens, without images.
- Touchpoints: globals.css, app/(public)/[slug]/page.tsx, app/page.tsx, components/ArticleCard.tsx, components/LoadMore.tsx, components/admin/ModerationQueue.tsx
- Steps:
  1) Apply design tokens for colors, radius, shadow, etc., using CSS variables.
  2) Wrap post body in `prose` container for global styles.
  3) Update ArticleCard and LoadMore components to use tokens for layout and theming.
  4) Ensure Comments section uses tokens for consistent theming.
- Acceptance:
  - Posts and comments adapt to light/dark mode via `data-theme` attribute.
  - No hardcoded colors or image-based styles; all use design tokens.
- Tests:
  - Visual regression tests for light/dark modes; ensure no snapshots are needed.
