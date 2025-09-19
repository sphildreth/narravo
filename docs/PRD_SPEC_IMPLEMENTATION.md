# PRD Implementation Tracker

This checklist captures outstanding work required to satisfy the specification in `docs/PRD_SPEC.md`. Items are grouped by PRD section. Mark entries with `[x]` once delivered.

## 1. MVP Scope — Delivery Slices

The MVP work is now grouped into incremental slices sized for independent agent delivery. Complete the slices in order unless otherwise noted; each slice rolls up to the original checklist items.

### Slice 01 – Identity Foundations
*Depends on:* none

- [x] Implement OAuth/OIDC login for Google and GitHub (optional X gated by configuration).
- [x] Add local admin bootstrap that promotes the first authenticated user and seeds Admin/Moderator/Author roles.
- [x] Expose `/login`, `/challenge/{provider}`, `/logout` endpoints and secure the admin shell with role-based authorization policies.

### Slice 02 – Core Publishing Baseline
*Depends on:* 01

- [x] Finalize EF Core models/migrations for posts, terms, users, reactions, comments, media, redirects, and supporting tables.
- [x] Render the home page with published posts, pagination, and base canonical/OG metadata.
- [x] Serve `/posts/{slug}` with author info, related terms, and Markdown-to-HTML rendering using the future sanitation hook.


> Verification: `PostService` now filters to released posts only (see `PostServiceTests`) ensuring unpublished drafts and scheduled content stay private.

### Slice 03 – Taxonomy & Author Navigation
*Depends on:* 02

- [x] Deliver `/tags/{slug}`, `/categories/{slug}`, and `/authors/{slug}` listing pages with pagination and canonical/OG metadata.
- [x] Wire posts to their tags/categories/authors in both UI and sitemap/feed generation.
- [x] Ensure term/author pages participate in navigation and breadcrumbs.

> Verification: Term and author listings validated via `ContentListingServiceTests` to ensure paging and entity wiring.

### Slice 04 – Comment Submission Foundation
*Depends on:* 02

- [x] Implement the comment domain model with single-level replies, statuses, and EF relationships.
- [x] Expose `/api/public/comments` minimal API with honeypot and baseline IP rate limiting.
- [x] Render approved comments and a submission form on post detail pages (client + server validation).

### Slice 05 – Moderation & Markdown Sanitation
*Depends on:* 04

- [x] Provide an admin moderation queue with approve/reject/spam flows and audit logging.
- [x] Integrate the Markdown editor (toolbar + preview) for moderators and sanitize Markdown ➜ HTML via the allowlist pipeline.
- [x] Extend anti-spam controls with rate limiting policies, spam flagging, and moderation notifications.

### Slice 06 – Reactions Engine
*Depends on:* 02

- [ ] Persist reactions with uniqueness per user ID + target + kind (no anonymous reactions allowed)..
- [ ] Implement `/api/public/reactions/toggle` with cached counts and idempotent toggling.
- [ ] Display reaction controls/counts on posts and comments with optimistic UI updates.

### Slice 07 – Media Platform
*Depends on:* 02

- [ ] Build admin media management (upload, list, delete) backed by `IFileStore`.
- [ ] Generate image variants with resizing and focal point cropping metadata.

### Slice 08 – Banner & Monthly Archive Experience
*Depends on:* 07

- [ ] Create banner admin UI with per-post overrides, hide options, and overlay contrast validation.
- [ ] Produce responsive banner assets (WebP + fallback) and lazy-load with explicit dimensions.
- [ ] Implement archive sidebar UX, `/yyyy/`, `/yyyy/mm/`, and monthly RSS feeds wired into sitemap.

### Slice 09 – Search Experience
*Depends on:* 02, 03

- [ ] Provide a default `ISearchIndex` implementation (SQLite FTS5) with indexing hooks on publish/update/delete.
- [ ] Deliver `/search` UI (and optional API) with highlighted results and pagination.
- [ ] Add search coverage to sitemap/feeds per spec.

### Slice 10 – Backup & Restore
*Depends on:* 02, 07

- [ ] Implement `/api/admin/backup` producing tarball packages (DB + media + config manifest with hashes).
- [ ] Support selective restore endpoints with dry-run diff and integrity validation.
- [ ] Surface admin UI for one-click backup download and selective restore flows.

### Slice 11 – WordPress Import (Content)
*Depends on:* 02, 07, 10

- [ ] Stream WXR to import posts, pages, categories, tags, and core postmeta with resumable checkpoints.
- [ ] Map WordPress GUIDs to local entities and upsert idempotently with detailed import logs.
- [ ] Provide admin import UI to upload, monitor progress, and review success metrics.

### Slice 12 – WordPress Import (Media & Redirects)
*Depends on:* 11

- [ ] Download and deduplicate attachments via SHA256, storing through the media pipeline.
- [ ] Rewrite imported content to local media URLs and create redirect mappings.
- [ ] Capture additional postmeta and preserve unknown shortcodes with logging.

### Slice 13 – Output Caching & SSG
*Depends on:* 02, 03, 04, 06, 08, 11

- [ ] Configure OutputCache tag policies for home, posts, terms, and archive routes.
- [ ] Hook domain events (`PostPublished|Updated|Deleted`, comment moderation, import completion) to cache invalidation.
- [ ] Implement optional SSG export that regenerates impacted pages on cache busts.

### Slice 14 – Security Hardening
*Depends on:* 04, 05, 06, 13

- [ ] Enforce the HTML sanitizer allowlist and safe link handling across public/admin rendering.
- [ ] Apply ASP.NET Core rate limiting policies for login, comments, reactions, import, and admin APIs.
- [ ] Configure CSP, HSTS, X-Frame-Options, Referrer, X-Content-Type-Options, and CSRF protections.

### Slice 15 – Admin Experience Completion
*Depends on:* 01, 02, 04, 06, 07, 10, 11

- [ ] Deliver admin dashboards for posts, comments, media, users, reactions, import, backup/restore, and site settings.
- [ ] Ensure role-based navigation, command surfaces, and authorization across Blazor components.
- [ ] Back admin screens with minimal APIs (`/api/admin/posts`, `/api/admin/import`, `/api/admin/backup`, `/api/admin/restore`).

### Slice 16 – Theme, Accessibility & Localization
*Depends on:* 02, 03, 08

- [ ] Create the default responsive theme with dark mode toggle and typography/layout polish.
- [ ] Achieve WCAG 2.1 AA: skip links, focus outlines, form labels, contrast (including banner overlay adjustments).
- [ ] Introduce localization resources for UI strings and locale-aware date formatting.

### Slice 17 – Observability & Deployability
*Depends on:* 01, 02

- [ ] Configure Serilog JSON logging with `traceId`/`spanId`/`userId` enrichment and structured request logs.
- [ ] Expose `/healthz` and `/readyz` endpoints hooked to DB and file store checks.
- [ ] Provide Dockerfile (multi-stage, non-root), docker-compose sample, systemd unit, and environment variable configuration guidance.
- [ ] Wire optional OpenTelemetry export and ensure configuration via `appsettings.json` + env overrides.

### Slice 18 – Background Services & Extensibility
*Depends on:* 02, 07, 10, 11

- [ ] Add hosted services for import, media processing, and scheduled backups with graceful shutdown.
- [ ] Ship default `ISearchIndex`, `IMediaProcessor`, and `IAuthProviderMapper` implementations and extension points.
- [ ] Introduce the in-process event bus and extensibility hooks for publish/update/restore flows.

### Slice 19 – Testing & Quality Gates
*Depends on:* slices introducing features under test

- [ ] Expand unit/integration coverage for comments, reactions, import, backup/restore, banner focal logic, and search.
- [ ] Add performance testing for hot routes and benchmark output cache hit rate targets.
- [ ] Configure analyzers/CI to treat warnings as errors and fail on regression.

### Slice 20 – Documentation & README
*Depends on:* completion of relevant feature slices

- [ ] Produce a modern README with installation, configuration, and quickstart instructions.
- [ ] Author the documentation set (`docs/getting-started.md`, `docs/deploy-docker.md`, `docs/backup-restore.md`, etc.) with runnable commands and verification steps.
- [ ] Document rate limit defaults, upload caps, configuration overrides, and security posture.

## 2. Technical Spec

This section now maps directly onto the slice backlog:

- Background hosted services → **Slice 18 – Background Services & Extensibility**.
- `ISearchIndex`, `IMediaProcessor`, `IAuthProviderMapper` implementations → **Slice 18**.
- Minimal APIs (`/api/admin/*`, `/api/public/*`) → **Slices 04, 06, 10, 11, 15**.
- Markdown editor with toolbar/preview → **Slice 05 – Moderation & Markdown Sanitation**.
- Accessibility, i18n, structured logging, health endpoints, single-binary packaging → **Slices 16 & 17**.
- Dockerfile, systemd unit, OpenTelemetry wiring → **Slice 17 – Observability & Deployability**.
- Extensibility hooks and in-process event bus → **Slice 18**.

## 3. Public Site — Banner & Monthly Archive

All banner and archive requirements funnel into **Slice 08 – Banner & Monthly Archive Experience**, which covers responsive assets, overlay contrast, admin override UX, archive navigation, and monthly feeds.

## 4. Testing & Quality

Testing deliverables are consolidated under **Slice 19 – Testing & Quality Gates** (unit/integration/perf/e2e coverage) with performance benchmarks aligned to Slice 13’s caching work.

## 5. Operations & Deployment

- Health/observability wiring → **Slice 17 – Observability & Deployability**.
- Operational documentation (rate limits, upload caps, deployment guides, license attribution) → **Slice 20 – Documentation & README**.

## 6. Documentation

The documentation backlog is captured in **Slice 20 – Documentation & README**, which enumerates the required guides (configuration, deployment, security, extensibility, theming, search, media, auth, admin, public UI, assets, archive, banner, footer/header/navigation) and enforces runnable verification steps.





---

# Additions & Clarifications (agent-ready)

## 1) MVP Scope — concrete specs & acceptance criteria

### Authentication (OAuth/OIDC + local bootstrap) — Slice 01
- **Providers**: Google & GitHub (X later). Local bootstrap CLI: `dotnet run -- admin create --email you@example.com`.
- **Callback paths**: `/signin-google`, `/signin-github`.
- **Role mapping**: first admin OR invite list file `data/admin_invites.json`. On successful OAuth, if email ∉ invites and first admin not set → 403 + message.
- **Security**: cookie `SameSite=Lax`, `HttpOnly`, `Secure` (prod). CSRF token required for all POST/PUT/DELETE in admin.
- **AC**: A new instance can create the first admin without editing code; subsequent logins require invite.

### Comments (1-level threading, moderation, anti-spam) — Slices 04 & 05
- **Model**: `Comment(Id, PostId, ParentId?, AuthorDisplay, AuthorUserId?, BodyMd?, BodyHtml, CreatedUtc, Status[PENDING|APPROVED|SPAM|DELETED], IpHash, UserAgent?)`.
- **Moderation**: queue page with bulk Approve/Spam/Delete. Status transitions logged.
- **Anti-spam**: hidden honeypot, min-time to submit (≥2s), IP+UA rate limit (5/min), blocklist support.
- **Rendering**: Markdown → sanitized HTML (allow: `p, a[href], strong, em, code, pre, ul, ol, li, blockquote, img[src]`).
- **AC**: Replies display nested one level; sanitizer blocks `<script>` and inline event handlers; rate limits observable in logs.

### Reactions (posts & comments) — Slice 06
- **Kinds**: `like|celebrate|clap`. Unique index: `(TargetType, TargetId, UserId/AnonCookie, Kind)`.
- **API**: `POST /api/public/reactions/toggle {targetType, targetId, kind}`; 20/min/IP rate limit.
- **AC**: Toggling updates counts instantly; reloading shows the correct state.

### Admin WYSIWYG (comments) — Slices 05 & 15
- **Editor**: Markdown toolbar with live preview; paste-to-link; drop images (admin-only) with upload to `/media/…`.
- **Sanitize**: server-side on save; no client-only trust.
- **AC**: XSS test strings render inert; diffs visible in moderation history.

### Backup & selective restore — Slice 10
- **Endpoint**: `GET /api/admin/backup`, `POST /api/admin/restore`.
- **Archive format**: `tar.gz` (or zip), includes:
    - `db/blog.db`,
    - `media/**`,
    - `config/appsettings.export.json` (no secrets),
    - `manifest.json` (see schema below).
- **Manifest schema (v1)**:
  ```json
  {
    "version": 1,
    "createdUtc": "2025-09-18T12:34:56Z",
    "db": { "provider": "sqlite", "filename": "blog.db", "sha256": "..." },
    "media": [{ "path": "media/...", "sha256": "...", "bytes": 12345 }],
    "counts": { "posts": 123, "comments": 456, "media": 789 },
    "selection": { "posts": "all" }
  }
  ```
- **Selective restore**: `/api/admin/restore?mode=post&slug=hello-world` restores that post, comments, reactions, related media.
- **AC**: Dry-run flag returns diff (creates/updates) without writing; hash check fails → 400 with list of mismatches.

### WXR import (complete) — Slices 11 & 12
- **Capabilities**: posts/pages, categories/tags, attachments (download & de-duplicate via SHA256), URL rewrite, redirects, postmeta capture.
- **Unknown shortcodes**: preserved in HTML with data attr `data-shortcode="foo"` and logged.
- **Resumable**: Store last processed GUID; idempotent upserts by WP GUID.
- **AC**: Import report JSON + human log; % of successes ≥95 on sample WXR.

### Public site features — Slices 02, 03, 08, 09, 13, 16
- **Routes**: `/`, `/posts/{slug}`, `/tags/{slug}`, `/categories/{slug}`, `/authors/{slug}`, `/search?q=`.
- **Pagination**: default 10/page; `?page=n`.
- **SEO**: `<link rel="canonical">`, OG/Twitter meta, JSON-LD Article on posts.
- **Feeds**: RSS `/feed.xml` (latest 20), optional tag/monthly feeds.
- **AC**: RSS & sitemap pass validators; core pages TTFB <200 ms on warm cache.

### Output caching & SSG — Slice 13
- **OutputCache policies**:
    - `home` → `/`
    - `post:{id}` → `/posts/{slug}`
    - `term:{id}` → tags/cats
    - `archive:{yyyy-mm}` → monthly archive pages
- **Eviction**: on `PostPublished|Updated|Deleted` → evict affected tags.
- **SSG**: incrementally regenerate changed pages (post, home, affected tag/category/archive pages).
- **AC**: Publishing a post refreshes home + its tag/category + month archive within a single event transaction.

### Security hardening — Slice 14
- **Headers**: CSP (`default-src 'self'`), HSTS, XFO deny, Referrer-Policy strict-origin-when-cross-origin, XCTO nosniff.
- **Rate limits**: login 5/min/IP; comments 5/min/IP; reactions 20/min/IP; import 1 concurrent job.
- **AC**: Security headers visible; rate limiting returns 429 with `Retry-After`.

---

## 2) Technical Spec — Slice 17 & 18 implementation details

### Background services — Slice 18
- **Jobs**:
    - `ImportWorker` (queue for WXR tasks; resumable),
    - `MediaWorker` (video poster, image resize),
    - `BackupWorker` (scheduled snapshots).
- **Interop**: in-process channel (`Channel<T>`) + graceful shutdown timeout (30s).
- **AC**: Ctrl-C stops workers cleanly; no partial writes.

### Storage & search — Slices 02, 09, 18
- **SQLite**: WAL mode; busy_timeout 5000 ms.
- **Search**: FTS5 virtual table `PostIndex(Title, Content)`; triggers to keep in sync; query via `MATCH`.
- **AC**: Search finds newly published posts within 1s.

### Abstractions — Slices 01 & 18
- **ISearchIndex**: `Index(Post)`, `Remove(PostId)`, `Search(query, topN)`.
- **IMediaProcessor**: `MakePoster(video)->posterPath`, `Resize(image)->variants[]`.
- **IAuthProviderMapper**: map external claims to roles (email domain allow-list optional).
- **AC**: Swapping search provider requires no UI changes.

### APIs — Slices 04, 06, 10, 11, 15
- **Public**: `/api/public/comments`, `/api/public/reactions`, safe CORS defaults off; JSON error envelope `{error:{code,message}}`.
- **Admin**: `/api/admin/import`, `/api/admin/backup`, `/api/admin/restore`, `/api/admin/posts` (CRUD).
- **AC**: All admin APIs require CSRF token + auth; 401/403 paths consistent.

### Admin editor — Slice 05
- **Markdown**: Markdig pipeline `.UseAdvancedExtensions().UseEmojiAndSmiley()`.
- **Sanitizer allowlist**: block `style`, `on*` attrs; limit `target="_blank"` to include `rel="noopener noreferrer"`.
- **AC**: Known XSS e2e tests pass.

### Accessibility/i18n/logging/health — Slices 16 & 17
- **A11y**: page landmarks, focus rings, skip links, form labels.
- **i18n**: resource files for UI strings; date formats locale-aware.
- **Logging**: Serilog JSON (`level`, `traceId`, `spanId`, `userId?`).
- **Health**: `/healthz` (liveness), `/readyz` (DB + file store).
- **AC**: Lighthouse a11y ≥ 90; health endpoints pass K8s probes.

### Packaging/ops — Slice 17
- **Docker**: multi-stage build; non-root user; volumes `/app/data` and `/app/media`.
- **Systemd**: sample unit with `Restart=always`, `EnvironmentFile=/etc/narravo.env`.
- **OpenTelemetry (opt-in)**: OTLP endpoint env var; traces for requests + DB.
- **AC**: `docker compose up` runs both Public & Admin with a shared volume.

---

## 3) Public Site — Slice 08 banner & monthly archive engineering details

### Banner — Slice 08
- **Data**: `Banner(Id, Path, Width, Height, Alt, Credit, CreditUrl, OverlayColor, OverlayOpacity, FocalX[0-1], FocalY[0-1], IsActive, CreatedUtc)`.
- **Responsive**: generate 640/1024/1600/2400 widths, WebP + fallback; `sizes="100vw"`.
- **Focal crop**: CSS `object-position: calc(FocalX*100%) calc(FocalY*100%)`.
- **Overlay text**: auto compute contrast (WCAG AA) and adjust overlay opacity.
- **AC**: Lighthouse LCP image flagged as properly sized; focal point remains centered across breakpoints.

### Monthly archives — Slice 08
- **Sidebar**: visible ≥1024px; on mobile, collapsible accordion.
- **Computation**: from `PublishedUtc`; query groups by year/month with counts; cached 15 min (or event-driven).
- **Routes**: `/2025/09/` & `/2025/`; monthly RSS `/{yyyy}/{MM}/feed.xml`.
- **AC**: Archive pages in sitemap; monthly RSS validates and includes only that month’s posts.

---

## 4) Testing & Quality — Slice 19 concrete plan
- **Unit**: sanitization allowlist, reaction toggle idempotency, redirect mapping, archive grouping, banner contrast calc.
- **Integration**: import (WXR fixtures), backup/restore round-trip, OAuth login happy path.
- **Perf**: bombardier `GET /posts/{slug}` hot path ≥3k rps on cache; cold ≤400ms p95.
- **Contract**: API tests (status codes, CSRF required).
- **AC**: CI fails on any warning (treat warnings as errors for Public/Admin/Infra).

---

## 5) DX, CI/CD, and coding standards — Slice 19 enablement
- **Analyzers**: enable .NET analyzers + `nullable enable`; `TreatWarningsAsErrors=true`.
- **Style**: `.editorconfig` with naming & formatting; Prettier for CSS/JS assets.
- **CI (GitHub Actions)**:
    - `dotnet format --verify-no-changes`,
    - `dotnet build -warnaserror`,
    - `dotnet test --collect:"XPlat Code Coverage"`,
    - publish Docker images on tags; attach SBOM.
- **Release**: GitHub Release with zip + container images; changelog from Conventional Commits.
- **Security**: `dotnet list package --vulnerable` in CI; Dependabot updates.
- **AC**: Green CI required to merge; release artifacts reproducible.

---

## 6) Documentation — Slice 20 table of contents and quickstarts
- **Docs structure**:
    - `docs/getting-started.md` (SQLite quickstart + OAuth secrets),
    - `docs/deploy-docker.md` (compose, volumes),
    - `docs/backup-restore.md`,
    - `docs/import-wxr.md`,
    - `docs/theme-banner.md` (focal point UI, sizes, caching),
    - `docs/archives.md`,
    - `docs/search.md` (FTS5 + PG),
    - `docs/extensibility.md` (interfaces & events),
    - `docs/security.md` (headers, rate limits, sanitizer),
    - `docs/metrics.md` (OTel),
    - `docs/troubleshooting.md`.
- **AC**: Each doc contains runnable commands and a verification step.

---

## 7) Concrete endpoint & event list — Reference for slices 02–15

- **Endpoints**
    - `GET /` `GET /posts/{slug}` `GET /tags/{slug}` `GET /categories/{slug}` `GET /authors/{slug}` `GET /search`
    - `GET /feed.xml` `GET /sitemap.xml` `GET /robots.txt`
    - `GET /{yyyy}/` `GET /{yyyy}/{MM}/` `GET /{yyyy}/{MM}/feed.xml`
    - `POST /api/public/comments` `POST /api/public/reactions/toggle`
    - `POST /api/admin/import` `GET /api/admin/backup` `POST /api/admin/restore`
    - `GET /login` `GET /challenge/{provider}` `GET /logout`

- **Domain events**
    - `PostPublished|Updated|Deleted` → cache evict (post/home/term/archive), re-index, SSG enqueue, optional CDN purge.
    - `CommentApproved|Deleted|MarkedSpam` → cache evict (post).
    - `MediaUploaded` → variants build, cache bust.
    - `ImportCompleted` → rebuild sitemap, feed.

---

## 8) Performance & scalability defaults — Slices 13 & 17
- **HTTP**: gzip + brotli (static).
- **Caching**: Memory cache size limit; cache keys tagged; eviction on events.
- **CDN** (optional): headers `Cache-Control: public, max-age=31536000, immutable` on hashed assets.
- **DB**: indexes on `Post.Slug`, `Term(Slug,Type)`, `Comment(PostId,CreatedUtc)`.
- **AC**: p95 home <100ms (warm) on 1 vCPU VPS.
