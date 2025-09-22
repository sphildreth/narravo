<!-- SPDX-License-Identifier: Apache-2.0 -->
# REQ_SEARCH — Public Post Search (MVP)

Goal
- Let visitors quickly find posts by title or body from anywhere on the site.
- Keep it fast, accessible, and safe by default; allow evolution to full‑text later.

Scope (MVP)
- Global search entry in the site navbar that expands a search bar.
- Dedicated results page rendering matching posts with pagination.
- Case‑insensitive contains matching against post title and content for published posts only.

Non‑Goals (for now)
- Cross‑entity search (comments, tags, categories, users).
- Faceted filters, advanced operators, or typo‑tolerance beyond simple contains.
- External search services (Algolia/Elastic). Use Postgres + Drizzle only.

Implementation overview
- UX: Search icon button in navbar opens a collapsible search bar under the navbar with an input and a primary action (Search/Clear). Keyboard: "/" focuses, Enter submits, Esc clears & collapses.
- Routing: Submit navigates to `/search?q=...&page=1`. Results are linkable/shareable.
- Server: RSC page reads `searchParams`, calls `lib/search.ts` to query DB via Drizzle/SQL.
 - Query: ILIKE contains on title, excerpt, and body (body_html preferred, fallback body_md) with a simple score so title matches rank higher; paginate. Published posts only (`published_at is not null`).
- Security: Validate inputs with Zod, bound lengths, sanitize highlights/snippets.
- Performance: Reasonable page size caps, index suggestions; “phase 2” path to Postgres full‑text with GIN.

## UX details
- Navbar placement: Add a search icon button immediately before the ThemeToggle in `components/Navbar.tsx` (site context only; not in admin nav).
- Expand/collapse behavior
  - Clicking the icon toggles a search bar that slides down beneath the navbar (role="search").
  - When expanded, the input is auto‑focused. Pressing Esc or clicking outside collapses and clears.
  - While a search term is active on the results page, keep a compact search bar sticky under the navbar for quick refinement.
  - Input has a visible label for accessibility (visually hidden label is fine) and placeholder "Search posts…".
  - Primary button label: shows "Search" when no query; becomes "Clear" after the first search for that session.
  - Keyboard: "/" focuses input when on site pages and not inside another input; Enter submits; Esc clears & collapses.
  - On submit, navigate to `/search?q=...` and collapse the bar.
- Results rendering
  - Results page shows total hits if cheap to compute, else just page counts ("Showing 1–10") and a title like `Search results for “{q}”`.
  - Each result is an existing Post card (reuse `components/ArticleCard.tsx`) with optional short snippet highlighting matches (see Snippets below).
  - Empty state: "No posts match “{q}”. Try a different search."

## Routes & URLs
- New page: `app/(public)/search/page.tsx`
  - Accepts `searchParams: { q?: string; page?: string; pageSize?: string }`.
  - If `q` missing/empty → redirect to `/` (index) or show friendly prompt to search.
  - Default `page=1`, `pageSize=10`, cap `pageSize<=50`.
- Optional API for typeahead (deferred): `GET /api/search/suggest?q=...` (rate limited, no-store). Not required for MVP.

## Server querying (lib)
- File: `src/lib/search.ts`
- Function signature
  - `async function searchPosts(input: { q: string; page?: number; pageSize?: number }): Promise<{ items: PostDTO[]; pagination: { page: number; pageSize: number; total?: number; hasMore: boolean } }>`
- Validation with Zod:
  - q: string, trimmed, min=2, max=100
  - page: number >=1; pageSize: 1..50
- SQL (MVP) — prefer `body_html`, fallback `body_md`:
  - Filters: `p.published_at is not null`
   - Score: `(case when p.title ilike :qLike then 2 else 0 end) + (case when p.excerpt ilike :qLike then 1 else 0 end) + (case when p.body_html ilike :qLike or p.body_md ilike :qLike then 1 else 0 end) as score`
  - Ordering: `score desc, p.published_at desc nulls last, p.id desc`
  - Pagination: `limit :limit+1 offset :offset` and compute `hasMore` via extra row.
  - Parameters: `qLike = '%' || q || '%'`.
- Result shape: `PostDTO` minimally includes id, slug, title, excerpt, publishedAt; do not return raw HTML.

## Snippets & highlighting
- Optional for MVP. If added, compute a text snippet on the server:
  - Use `excerpt` if present and contains the term (case-insensitive); otherwise extract a substring around the first match from `body_html` stripped to text.
  - Highlight term occurrences by wrapping in `<mark>`; ensure snippet is sanitized (isomorphic-dompurify) before rendering in client. Avoid returning unsanitized HTML from the server; either return plain text + ranges or sanitized small HTML.
- MVP is acceptable to show only `excerpt` without highlight to keep scope small.

## Indexes & performance
- MVP indexes (safe and simple):
  - Ensure existing ordering uses `posts.published_at` index if available.
   - Add btree index for case-insensitive title search: `create index concurrently if not exists posts_title_lower_idx on posts (lower(title));` Optionally add `posts_excerpt_lower_idx` on `lower(excerpt)` if excerpt is frequently used.
- Phase 2 (optional):
  - Enable extensions: `pg_trgm` and/or `unaccent`.
  - Trigram GIN for contains: `create index posts_title_trgm on posts using gin (title gin_trgm_ops);` and optionally on a materialized column of stripped body text.
  - Or full‑text: generated `tsvector` (title boosted + stripped body) + GIN; query via `to_tsquery/plainto_tsquery` and rank.

## Caching & rate limiting
- The results page is user‑specific; prefer no caching for the data fetch (`cache: 'no-store'` where applicable).
- If a suggest API is later added, protect it with `lib/rateLimit.ts` (e.g., 60 req/min/ip) and set `Cache-Control: no-store`.

## Accessibility
- The search toggle button has `aria-expanded` and `aria-controls` linking to the collapsible region with `role="search"`.
- Input has an associated `<label>` (can be visually hidden) and `aria-label="Search posts"`.
- Do not trap focus as a modal. Pressing Esc clears the input and collapses.

## Security
- Validate query inputs with Zod before constructing SQL. Use parameterized queries via Drizzle `sql` helpers.
- Sanitize any snippet HTML returned. Never expose `body_html` raw to the client via search results.

## Edge cases
- Empty query or less than 2 characters → show validation error inline and do not submit.
- Very long queries (>100) are truncated or rejected.
- Non‑word characters: treat as literals in MVP; no regex or wildcards.
- Pagination beyond available pages → show empty results page with navigation back.

## Testing (Vitest)
- Unit (lib)
  - searchPosts validates inputs and paginates as expected.
  - Title‑only match returns higher score than body‑only.
  - page/pageSize clamped; `hasMore` set correctly.
- Integration (seeded DB)
  - Seed several posts with controlled titles/bodies; queries return expected ordering and counts.
  - Unpublished posts never appear.
- UI smoke
  - Clicking navbar search opens input, focuses, Esc collapses.
  - Submitting navigates to `/search?q=...` and renders cards.

## Acceptance criteria
- A search icon appears before the light/dark switch on site pages.
- Clicking it expands a search bar; entering a term ≥ 2 chars and pressing Enter navigates to `/search?q=term`.
- While a search term is active, a compact search bar remains sticky below the navbar on the results page.
- The results page lists matching posts where title or body contains the term (case‑insensitive), ordered by relevance then recency.
- Clicking Clear resets the input, collapses the bar, and the home/index shows all posts as normal.
- Input validation, accessibility roles/labels, and sanitation rules are in place.

## Files/modules to add or change
- `src/components/Navbar.tsx` — add search toggle button (site context only) and collapsible region.
- `src/app/(public)/search/page.tsx` — RSC page reading `q` and rendering results with pagination.
- `src/lib/search.ts` — query implementation (MVP ILIKE based) with Zod validation.
- `tests/search.test.ts` — unit/integration tests for search behavior.
- (Optional) Migration for indexes:
  - `drizzle/migrations/000X_posts_search_indexes.sql` to add `posts_title_lower_idx` (and future trigram/tsvector indices in a later phase).

## Try it (once implemented)
```bash
pnpm i
# If indexes migration is added
pnpm drizzle:generate
pnpm drizzle:push
pnpm dev
# Open http://localhost:3000 and press / to search
```

## Future enhancements (Phase 2+)
- Postgres full‑text search with weighted `tsvector` and GIN index; language-aware stemming.
- Typeahead suggestions endpoint with rate limiting and small in-memory cache.
- Filter chips (category/tag), date range, and sort by newest/most relevant.
- Synonym dictionary and typo tolerance via trigram similarity.
