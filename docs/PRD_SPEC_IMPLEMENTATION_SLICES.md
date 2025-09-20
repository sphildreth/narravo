# Narravo — Implementation Guide (Agent Slices)

**Stack:** Next.js (App Router, RSC, Server Actions) + TypeScript + Tailwind + Auth.js + Drizzle ORM (Postgres) + S3/R2  

**Goal:** Deliver MVP features from the PRD in small, parallelizable tasks with clear acceptance criteria and verification commands.

**Slice Status:** When completed set the slice checkbox to [x] to indicate done.

---

Prompt
> Implement [slice name] exactly per @docs/PRD_SPEC_IMPLEMENTATION_SLICES.md; deliver code + tests + minimal docs; no scope beyond described endpoints/models; verify with pnpm build && pnpm test. Mark slice completed when done.

---

## 0) Baseline Setup (all slices assume this)
- Repo structure (from skeleton):
  ```
  /app
    /(public)/, /(auth)/, /(admin)/
    /api/auth/[...nextauth]
    /api/r2/sign
    layout.tsx, globals.css
  /drizzle/schema.ts
  /lib/db.ts, /lib/auth.ts, /lib/sanitize.ts, /lib/commentsPath.ts
  /scripts/import-wxr.ts
  /tests
  ```
- Env:
    - `DATABASE_URL=postgres://narravo:changeme@localhost:5432/narravo`
    - Auth keys (`GITHUB_*`, `GOOGLE_*`), `NEXTAUTH_SECRET`
    - S3/R2 vars if doing uploads
- DB up:
  ```bash
  docker compose up -d db
  pnpm drizzle:push
  ```
- Verification commands (common):
  ```bash
  pnpm i
  pnpm build
  pnpm test
  pnpm dev
  ```

---

##  Slice A — Auth & Session Gate
**Summary:** Configure Auth.js (GitHub, Google); require auth for comment/reaction actions; seed first admin or email allowlist.

- [x] Completed

**Deliverables**
- `/app/api/auth/[...nextauth]/route.ts` with GitHub + Google providers and JWT session
- Guard helpers: `requireSession()` (already present) + `requireAdmin()` (new; based on allowlist or first user)
- Add login-CTA guards on comment/reaction UI stubs

**Acceptance**
- Clicking “Sign in with GitHub/Google” completes OAuth and sets a session
- Unauthed POST to protected server actions returns 401/rejects
- First-user bootstrap or email allowlist grants admin

**Files**
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts` (extend)
- `app/(auth)/login/page.tsx` (minor polish)

---

## Slice B — Post Model & Static Rendering (ISR)
**Summary:** Render post pages statically with ISR; list posts on home; revalidate on changes.

- [x] Completed

**Deliverables**
- Drizzle queries for posts (`getPostBySlug`, `listPosts`)
- Static post page `/[slug]` using RSC; `revalidateTag("post:{id}")` support
- Home list page with pagination (static, `revalidate = 60`)

**Acceptance**
- `/` shows latest posts; `/my-post` renders title/body
- Editing DB then calling `revalidateTag("post:{id}")` updates output

**Files**
- `app/(public)/[slug]/page.tsx`
- `app/(public)/page.tsx`
- `lib/posts.ts` (new; Drizzle queries)
- Tagging helper (new) if needed

---

## Slice C — Nested Comments (Materialized Path)
**Summary:** Server actions to create/read comments, with materialized path and bounded depth (e.g., 4).

- [x] Completed

**Deliverables**
- Server action: `createComment(postId, parentId|null, bodyMd)` → sanitize → insert
- Read API: list a post’s comments ordered by `path`
- UI: threaded rendering on post page; simple form per node

**Acceptance**
- Depth limit enforced; parent not found → 400
- Sanitization strips inline handlers/scripts
- Rate limit (see Slice H) stubbed or enforced

**Files**
- `app/(public)/[slug]/page.tsx` (thread UI + form)
- `lib/commentsPath.ts` (already present; use it)
- `lib/sanitize.ts` (already present)
- `lib/comments.ts` (new; queries)

**Tests**
- Unit: path builder, sanitization
- Integration: create root/child, depth enforcement

---

## Slice D — Reactions (Post & Comment)
**Summary:** Toggle reactions with unique constraint per (targetType, targetId, userId, kind).

- [ ] Completed

**Deliverables**
- Server action: `toggleReaction(targetType, targetId, kind)`
- Reaction counts surfaced with comments/posts

**Acceptance**
- Same user toggling same kind flips on/off
- Unique constraint holds; counts correct after refresh

**Files**
- `lib/reactions.ts` (new)
- UI chips/buttons on post and per-comment

**Tests**
- Integration: toggle twice → net zero; distinct kinds coexist

---

## Slice E — Media Uploads for Comments (Images + Videos)
**Summary:** Direct-to-S3/R2 uploads via presigned URLs; server validates and records attachments; ffmpeg poster generation (async).

- [ ] Completed

**Deliverables**
- API route `/api/r2/sign` validates mime/size; returns presigned fields
- Client upload component (comment form) for image/video
- Server job to generate poster for videos (can be in-process for MVP)

**Acceptance**
- Image ≤5MB, video ≤50MB/≤90s enforced
- Uploaded media appears in comment after submit
- Video shows `poster` once job completes

**Files**
- `app/api/r2/sign/route.ts`
- `components/CommentUpload.tsx` (new)
- `lib/s3.ts` (new; S3/R2 client)
- `lib/jobs.ts` (new; poster generation stub)

---

## Slice F — Moderation Queue (Admin)
**Summary:** Admin page to review `pending`/`spam`, approve/deny/spam/delete; bulk actions.

- [ ] Completed

**Deliverables**
- Admin route: `/admin/moderation`
- Server actions: `moderateComment(id, action)`
- Filters, pagination; preview pane

**Acceptance**
- Pending comments appear; actions change status
- On approve/deny/spam/delete, post page is revalidated

**Files**
- `app/(admin)/admin/moderation/page.tsx`
- `lib/moderation.ts` (new)

**Tests**
- Integration: status transitions; revalidateTag is called

---

## Slice G — WXR Importer (Posts + Media + Redirects)
**Summary:** CLI to import WXR with idempotency by GUID; downloads media; creates redirects.

- [ ] Completed

**Deliverables**
- `scripts/import-wxr.ts` (expand from stub)
    - Parse items; map post HTML; slugify; upsert by GUID
    - Download attachments to S3/R2; de-dup by SHA256
    - Rewrite inline image URLs
    - Create `redirects(fromPath→toPath)`
    - Report JSON (counts/errors); resume from checkpoint
- Admin trigger (optional MVP): dry-run & run with progress (can be later slice)

**Acceptance**
- ≥95% items imported on sample export; redirects resolve; media linked
- Idempotent (re-run has no duplicates)

**Tests**
- Integration with small WXR fixture

---

## Slice H — Rate Limiting & Anti-Abuse
**Summary:** Enforce limits and basic anti-spam on writes.

- [ ] Completed

**Deliverables**
- Rate limits: comments `5/min`, reactions `20/min` (by user+IP)
- Honeypot field & ≥2s minimum submit time

**Acceptance**
- Exceeding limits returns 429; honeypot blocks bots
- Legit submissions within limits succeed

**Files**
- `lib/rateLimit.ts` (new)
- Wire into createComment/toggleReaction server actions

---

## Slice I — Banner & Monthly Archives
**Summary:** Admin controls for banner + public rendering; archive pages & sidebar; monthly RSS; sitemap entries.

- [ ] Completed

**Deliverables**
- Admin “Appearance” (can be simple page) to set banner (image, alt, credit, overlay, focal point)
- Public banner component with responsive `srcset`, overlay, focal point
- Archives:
    - Routes: `/{yyyy}/`, `/{yyyy}/{MM}/` with pagination
    - Sidebar lists last 24 months with counts; collapsible on mobile
    - Monthly RSS at `/{yyyy}/{MM}/feed.xml`
    - Add to sitemap
- Revalidation tags: `archive:{ym}`, `home`

**Acceptance**
- Archive counts correct; changing publish dates changes counts and revalidates
- Banner readable (WCAG AA) in light/dark

**Files**
- `app/(public)/[year]/page.tsx`, `[year]/[month]/page.tsx` (or similar)
- `app/(public)/[year]/[month]/feed.xml/route.ts`
- `components/Banner.tsx`, admin page under `/admin/appearance`
- `lib/archives.ts`, `lib/rss.ts`, `lib/seo.ts` (new)

---

## Slice J — SEO, Feeds & Redirects
**Summary:** Global SEO helpers; site-wide RSS; redirects middleware.

- [ ] Completed

**Deliverables**
- `/feed.xml` (latest 20)
- `sitemap.xml` including posts & month archives
- Canonical, OG/Twitter, JSON-LD Article per post
- Redirects middleware/route for legacy paths (301)

**Acceptance**
- Feed validates; sitemap includes expected URLs
- Redirects from legacy paths hit new slugs

**Files**
- `app/feed.xml/route.ts`, `app/sitemap.xml/route.ts`
- `middleware.ts` for redirects
- `lib/seo.ts`

---

## Slice K — Backup & Restore
**Summary:** Export/import site content.

- [ ] Completed

**Deliverables**
- `scripts/backup.ts` creates `zip` with DB dump (or select tables), media manifest, `manifest.json`
- `scripts/restore.ts` dry-run + selective restore by slug or time window

**Acceptance**
- Round-trip succeeds on sample data
- Dry-run clearly lists planned changes

---

## Slice L — Theming (Tokens + Toggle)
**Summary:** CSS variable tokens + Tailwind mapping; SSR cookie theme; toggle component.

- [ ] Completed

**Deliverables**
- Tokens in `globals.css` (`--bg`, `--fg`, `--brand`, etc.) for light/dark
- Tailwind maps tokens; focus-visible styles; prose styles
- `<html data-theme={cookieTheme}>` in `layout.tsx`
- `components/ThemeToggle.tsx` + server action/route to set cookie

**Acceptance**
- No FOUC; theme persists via cookie; accessible focus rings

---

## Slice M — Security Headers & Health
**Summary:** Add CSP/HSTS/etc; health endpoints.

- [ ] Completed

**Deliverables**
- `next.config.mjs` headers function or `middleware.ts` to set:
    - CSP (start restrictive; allow images/video via S3 domain)
    - HSTS, X-Content-Type-Options, Referrer-Policy
- Health routes: `/healthz` (DB ping), `/readyz` (DB + S3 ping)

**Acceptance**
- Headers present in responses; `/healthz` and `/readyz` return 200 when healthy

---

## Slice N — Testing & CI
**Summary:** Expand unit/integration tests and wire a basic CI.

- [ ] Completed

**Deliverables**
- Tests:
    - Unit: sanitization, path utils, RSS date formatting
    - Integration: comments, reactions, importer with fixture
- GitHub Actions: `pnpm i && pnpm build && pnpm test`

**Acceptance**
- CI green on PR; coverage threshold noted (e.g., keep key modules covered)

---

## Slice O — Deployment Recipes
**Summary:** Ship simple deploy paths.

- [ ] Completed

**Deliverables**
- Vercel guide (env vars, Postgres/Neon, R2 credentials)
- Docker Compose for self-host: web, postgres, minio (S3), caddy (optional)

**Acceptance**
- Following the docs yields a working instance

---

# Shared Implementation Notes

## Data model & migrations
- Keep schema in `drizzle/schema.ts`; generate/push via `drizzle-kit`
- Use UUID primary keys; unique indexes for slugs and reactions uniqueness
- For comments path, index `(post_id, path)` and `(post_id, status)`

## Server actions & cache invalidation
- After mutations (createComment, toggleReaction, moderateComment), call `revalidateTag("post:{id}")` and relevant archive/home tags
- For monthly archives, compute `ym = yyyy-MM` and tag `archive:{ym}`

## Sanitization & safety
- Use server-side DOMPurify allowlist
- Disallow inline event handlers; enforce `rel="noopener noreferrer"` on external links
- Validate MIME by both header and magic number for uploads

## Rate limiting
- Fallback: in-memory limiter (dev only)

## Logging & metrics
- Log JSON with request id; include actor id on moderation events
- Basic metrics: counts for comments/reactions; durations for importer

---

# Verification Checklist (for reviewers)
- [ ] No secrets committed; envs in `.env*` only
- [ ] DB migrations safe & idempotent
- [ ] Server actions check auth and rate limits
- [ ] Sanitization applied on save and render
- [ ] Revalidation tags used on mutations
- [ ] Tests added/updated; CI passes
- [ ] Docs updated if user-visible behavior changed
