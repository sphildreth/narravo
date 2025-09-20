# Narravo — Product Requirements Document (PRD)
**Version:** 1.0 (Next.js Edition)  

---

## 1) Problem & Objectives
**Problem:** Existing WordPress → self-hosted migrations are fragile; many “simple blog” engines lack robust import, moderation, or modern auth.  
**Objectives:**
- Import reliably from **WXR** (posts, pages, media, redirects).
- Serve **fast static posts** with modern SEO.
- Require **OAuth login** for **all interactions** (comments, reactions).
- Provide **nested threaded comments** with moderation & media (images/videos).
- Keep **deployment simple**; make backups/restores easy and verifiable.

**Non-goals (MVP):** multi‑tenancy, complex roles/permissions, page builders, plugins marketplace.

---

## 2) Target User & Scope
- **Primary:** Single blogger who values control, speed, and mod tools.
- **Audience:** Many readers who will sign in (GitHub/Google) to **comment** and **react**.
- **Admin:** Same blogger; one privileged account is sufficient for MVP.

---

## 3) Core Requirements (MVP)
### 3.1 Content
- **Posts**
    - Title, slug, HTML (sanitized), excerpt, publishedAt, updatedAt.
    - **Static generation** with **ISR** for performance.
    - Categories/Tags (flat taxonomy) — optional for MVP but enabled in import.
    - Per‑post canonical URL, OpenGraph/Twitter meta, JSON‑LD *Article*.
- **Pages** (optional import target from WXR; render statically).

### 3.2 WXR Import (WordPress XML)
- **Capabilities:** posts/pages, categories/tags, attachments (download), rewrite inline image URLs, map legacy permalinks to new **redirects** (301).
- **Idempotency:** Upsert by WP GUID. Resume from last item on failure.
- **Media:** Download to S3/R2; avoid duplicates via SHA256; relink in HTML.
- **Report:** Summary (counts, failures), per‑item errors; unknown shortcodes preserved as raw HTML with `data-shortcode="name"`.
- **Admin UI:** Run import with dry‑run; show progress; single concurrency.
- **Acceptance:** ≥95% success on sample export; redirects resolve; broken media <5% with reasons logged.

### 3.3 Authentication & Authorization
- **Auth providers:** GitHub + Google via Auth.js.
- **Requirement:** **All** interactions (comments, reactions) **require login**.
- **Admin access:** Email allowlist or first‑user bootstrap. Logout/Session mgmt included.

### 3.4 Comments (Nested/Threaded)
- **Structure:** Materialized path (`0001.0005.0002`) with bounded depth (e.g., 4).
- **States:** `pending | approved | spam | deleted`.
- **Display:** Threaded UI, newest-first within a thread; show author name/avatar (from provider).
- **Moderation:** Admin queue to approve, mark spam, or delete (hard/hide). Bulk actions.
- **Anti‑abuse:** Honeypot field; minimum submit delay (≥2s); **rate limits** (5/min per IP+user); server-side sanitize (no inline handlers); link rel `noopener`/`noreferrer`.
- **Media in comments:** Image + Video attachments.
    - **Limits:** Image ≤5MB; Video ≤50MB and ≤90s; MIME & magic‑number validation.
    - **Uploads:** Direct-to S3/R2 via presigned URLs.
    - **Video poster:** Generate via ffmpeg (async job); render `<video controls poster>`.
- **Admin WYSIWYG for comment editing:** Markdown editor w/ preview (TipTap/Tiny optional later); sanitize on save.

### 3.5 Reactions
- **Kinds:** `like | love | clap | celebrate` (extensible).
- **Targets:** Post or Comment.
- **Uniqueness:** 1 reaction per kind per user per target (unique index).
- **API:** Toggle semantics; **rate limit** 20/min per IP+user.

### 3.6 Moderation & Admin
- **Moderation UI:** Pending/spam queues; item preview; approve/deny/spam/delete.
- **Site Settings:** Banner control (see 3.8), theme selection, basic metadata.
- **Auditability:** Minimal action log (who/when approved/denied).

### 3.7 Backups & Restore
- **Backup button:** Download `zip` (or `tar.gz`) containing:
    - Database export (SQL dump) **or** snapshot (managed by provider).
    - `/media` tree (or S3 inventory manifest).
    - `manifest.json` with hashes & counts; `config export` (no secrets).
- **Selective restore:** By slug or time range (posts + related comments/reactions/media).
- **Dry‑run restore:** Show planned creates/updates; integrity checks via SHA256.
- **Acceptance:** Round‑trip on a sample instance restores all content accurately.

### 3.8 Banner & Monthly Archives (from shildreth.com UX cues)
- **Banner:** Top banner with image (hometown vibe).
    - Admin fields: image, alt, (optional) credit/link, overlay color/opacity (0–60%), focal point x/y (0–1).
    - Generated responsive renditions (e.g., 640/1024/1600/2400) + dimensions; overlay ensures readable headings (WCAG AA).
    - Display on Home, Post, Tag/Category, and Archive pages; allow per‑post override (MVP: data field only).
- **Monthly Archives:**
    - Sidebar list of months with post counts (last 24 months), visible on desktop; collapsible on mobile.
    - Routes: `/{yyyy}/` & `/{yyyy}/{MM}/` with pagination (10/page) and monthly RSS `/{yyyy}/{MM}/feed.xml`.
    - Included in sitemap; cache + invalidate on publish/unpublish/date change.

### 3.9 SEO & Feeds
- **SEO:** Canonical link, OpenGraph/Twitter meta, JSON‑LD Article (posts), robots.txt.
- **Sitemap:** Posts, pages, archives (year/month with content).
- **RSS:** `/feed.xml` (latest 20) **and** monthly feeds.
- **Redirects:** Resolve legacy paths to new slugs (301).

### 3.10 Theming & Accessibility
- **Theming:** CSS variables tokens (`--bg`, `--fg`, `--brand`, etc.), Tailwind maps; dark/light + brand variants.
- **Switcher:** Toggle via `data-theme` on `<html>`; SSR cookie to avoid FOUC.
- **A11y:** Focus-visible rings; color contrast meets WCAG AA; keyboard navigable.

### 3.11 Performance & Caching
- **Posts:** Static/ISR; tags for revalidation on publish/update/moderate: `post:{id}`, `archive:{ym}`, `home`, `term:{id}`.
- **Interactions:** Minimal server actions backed by Postgres.
- **Media:** S3/R2; CDN cache headers; hashed filenames, long max‑age/immutable.

### 3.12 Security
- **Headers:** CSP (`default-src 'self'`), HSTS, X-Content-Type-Options, Referrer-Policy.
- **Sanitization:** Server‑side DOMPurify allowlist for rendered HTML/comments.
- **Auth:** Sessions via Auth.js; HTTPS in prod; CSRF safe by Server Actions + same-site cookies.
- **Abuse control:** Rate limits (login 5/min; comments 5/min; reactions 20/min; import single‑job).

---

## 4) Nice-to-haves (Post‑MVP)
- Full‑text search (Postgres `tsvector`) and `/search?q=` page.
- Author profiles; per‑post series.
- Webhooks (e.g., Slack on new comments).
- Analytics (privacy‑aware).

---

## 5) System Overview (Reference Architecture)
- **Frontend/App:** Next.js (App Router, RSC, Server Actions), TypeScript, Tailwind, Radix primitives.
- **Auth:** Auth.js (GitHub/Google).
- **DB:** PostgreSQL (Neon/Supabase/Compose local) via Drizzle ORM + migrations.
- **Storage:** S3‑compatible (Cloudflare R2 / S3).
- **Workers:** In‑process jobs (import, poster generation); future: queue if needed.
- **Deployment:** Vercel (+ Neon + R2 + Upstash) or Docker Compose self‑host.

---

## 6) Data Model (High Level)
- `posts(id, slug, title, html, excerpt, publishedAt, createdAt, updatedAt)`
- `users(id, email, name, image)`
- `comments(id, postId, userId, parentId, path, depth, bodyHtml, bodyMd, status, createdAt)`
- `comment_attachments(id, commentId, kind, url, posterUrl, mime, bytes)`
- `reactions(id, targetType, targetId, userId, kind, createdAt)` (unique: type+id+user+kind)
- `redirects(id, fromPath, toPath, status)`
- `settings_banner(id, path, alt, credit, creditUrl, overlayColor, overlayOpacity, focalX, focalY, isActive, createdAt)`

---

## 7) Admin UX (MVP)
- **Navigation:** Dashboard, Posts (list), Moderation, Appearance (Banner/Theme), Import/Backup.
- **Moderation:** Table with filters (pending/spam); item preview; bulk actions.
- **Appearance:** Upload/select banner; edit overlay/focal point; preview.
- **Import:** Upload WXR; dry‑run; run; progress log; resume/stop.
- **Backup/Restore:** Download full/partial; selective restore by slug; dry‑run diff.

---

## 8) Acceptance Criteria (Selected)
- **WXR Import:** ≥95% items imported; media downloaded; redirects created; resumable; JSON report saved.
- **Auth:** Only logged‑in users can submit comments/reactions; unauthenticated users prompted to log in.
- **Comments:** Threaded rendering; sanitize verified (no inline JS); rate limit enforced; video posters display.
- **Moderation:** Approve/deny/spam/delete works; cache/ISR revalidation triggers on state changes.
- **Reactions:** Toggle idempotent; counts correct after reload; rate limit enforced.
- **Banner/Archives:** Banner readable in light/dark; archives show correct counts; monthly RSS validates.
- **SEO:** RSS passes validator; sitemap includes posts & month archives; canonical/OG are correct.
- **Backup/Restore:** Download succeeds; dry‑run shows diff; selective restore by slug works.
- **Perf:** Home/Post TTFB fast (ISR); no unbounded API response times under light load.

---

## 9) Metrics & Logging
- **Metrics:** comment submissions, reaction toggles, import duration/success %, moderation actions.
- **Logs:** JSON logs with request id; import job logs persisted; media failures logged with URL/source.
- **Health:** `/healthz` basic (DB reachable), `/readyz` (DB + storage).

---

## 10) Risks & Mitigations
- **Import quality varies:** Keep robust logging, dry‑run, idempotent resumes; expose error download.
- **Spam/abuse:** Auth‑required interactions, honeypot, delays, rate limits; later: Akismet/ML if needed.
- **Media cost on R2/S3:** Size caps and compression; lazy posters; CDN caching.
- **SEO regressions:** Validate feeds & sitemap in CI; snapshot tests for meta tags.

---

## 11) Out of Scope (for MVP)
- Multi‑user authoring & granular roles.
- Plugin architecture.
- Full site page builder.
- Multi‑tenant SaaS.

---

## 12) Rollout & Docs
- Docs: Getting started (Docker DB onboarding), OAuth setup (GitHub/Google), Import guide, Backup/Restore, Theming.
- Demo data: optional seed script for posts/comments to showcase UI.
- Release: GitHub releases with zip + changelog; example deploy on Vercel.

---

## 13) Test Plan (High Level)
- **Unit:** sanitization allowlist; reaction uniqueness; archive grouping; banner contrast calc.
- **Integration:** WXR import (fixtures) → DB rows/media; backup/restore round‑trip; auth-protected routes.
- **Contract:** API return shapes & codes; rate limit 429 behavior.
- **E2E (optional):** Post page with comment submit + moderation flow; reaction toggle.
