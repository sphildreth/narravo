# Project: Lightweight FOSS Blog Platform — Narravo

**Stack**: ASP.NET Core 9, Blazor Server (Admin), Razor Pages (Public) with prerender & OutputCache, EF Core (SQLite), Ant Design Blazor (Admin UI), Caddy/Nginx, MIT License.

**Goal**: Import from WordPress WXR reliably, provide a fast public site and a delightful admin, with tiny footprint and clear extensibility.

---

## 1) PRD

### Problem
Self-hosting WordPress can be cumbersome. Narravo targets a developer-friendly, minimal blog platform that reliably imports WXR, serves fast HTML, and offers a modern admin with comments and reactions.

### Users
- Site Owners (technical creators)
- Readers (anonymous visitors)
- Contributors/Editors (future)

### Success Metrics
- ≥95% import success (typical WXR) with import log.
- Public TTI <200ms on modest VPS; >95% cache hit for hot routes.
- Zero-downtime backup/restore proven by e2e test.

### MVP Scope (Must-Have)
1. OAuth/OIDC login (Google, GitHub; X if feasible) + local admin.
2. Comments with threading (1 level), moderation, spam controls.
3. Reactions on posts/comments (👍 🎉 👏), one per user per target.
4. Video in comments (≤50MB, ≤90s) with poster generation.
5. Admin WYSIWYG for comments; Markdown + sanitize pipeline.
6. One-click full **Backup** (DB+media+config) + **Selective Restore**.
7. WXR Import: posts/pages, categories/tags, media download & URL rewrite, redirects, postmeta capture.
8. Public site: home, post detail, tags/cats, author, search, RSS/Atom, sitemap.xml, canonical/OG meta, pagination.
9. Performance: OutputCache + tag invalidation; optional SSG export.
10. Security: HTML sanitization, rate limits, CSRF, CSP headers, roles.

### Nice-to-Have
- Drafts & scheduled publishing; per-post redirects UI; import dry-run; webhooks.

### Out of Scope (v1)
- Multi-tenant SaaS, advanced Gutenberg fidelity, WYSIWYG for posts (Markdown first), ActivityPub.

### User Stories (selected)
- As admin, sign in with Google/GitHub → first user becomes Admin.
- As reader, post comment (optionally with video) → pending if moderation on.
- As reader, toggle a reaction → unique per user+target+kind.
- As admin, click **Backup** → download tar.gz; restore full or selective.
- As admin, import WXR → progress & report; media rewritten; redirects created.

### Non-Functional
Accessibility (WCAG 2.1 AA), i18n-ready, structured logs, health endpoints, single-binary deploy, SQLite default.

### Release Plan
Alpha → core models, SSR public, basic import, admin login.  
Beta → media, taxonomy, RSS/sitemap, reactions.  
v1.0 → comments+moderation, backup/restore, SSG export, e2e tests.

---

## 2) Technical Spec

### Architecture
- Public: Razor Pages (or prerendered components) + OutputCache; no persistent client circuit.
- Admin: Blazor Server (Ant Design Blazor) under `/admin`.
- Data: EF Core code-first; `UseSqlite` default; optional `UseNpgsql`.
- Storage: `IFileStore` (LocalFileStore default; S3/MinIO future).
- Search: `ISearchIndex` (SQLite FTS5~~~~).
- Background: `IHostedService` for import, media posters, backups.

### Data Model (initial)
- Post(Id, Title, Slug, ContentMd, ContentHtml, Excerpt, Status, PublishedUtc, UpdatedUtc, AuthorId, RowVersion)
- Term(Id, Name, Slug, Type); PostTerm(PostId, TermId)
- User(Id, Provider, ProviderKey, Email, DisplayName, Roles)
- Comment(Id, PostId, ParentId?, AuthorDisplay, AuthorUserId?, BodyMd, BodyHtml, CreatedUtc, Status)
- CommentAttachment(Id, CommentId, Kind[VIDEO], Path, Mime, Size, DurationSec?, PosterPath?)
- Reaction(Id, TargetType, TargetId, UserId?, Kind, CreatedUtc) [Unique(Target, User, Kind)]
- Media(Id, OriginalUrl?, LocalPath, Mime, Width?, Height?, Sha256, CreatedUtc)
- Redirect(Id, FromPath, ToPath, HttpStatus)
- PostMeta(Id, PostId, Key, Value)
- ImportLog(Id, Kind, Ref, Level, Message, CreatedUtc)
- BackupLog(Id, Kind, Status, ManifestPath, CreatedUtc)

### Auth & Roles
OIDC for Google/GitHub (+X when possible), cookie auth; roles Admin/Author/Moderator; first user becomes Admin.

### Comments
One-level threading (ParentId), moderation statuses, spam mitigations (honeypot, rate-limit), Markdown→HTML + sanitize, admin WYSIWYG, video pipeline (validate, poster via ffmpeg, range requests).

### Reactions
Upsert/toggle per user per target; counts cached; SSR-safe.

### Import (WXR)
Streaming XML → staging → upsert posts/pages → map terms → download attachments (SHA-dedupe) → rewrite links → create redirects. Unknown shortcodes logged.

### Public Rendering
Routes: `/`, `/posts/{slug}`, `/tags/{slug}`, `/categories/{slug}`, `/authors/{slug}`, `/search?q=`.  
OutputCache tags: `home`, `post:{id}`, `term:{id}` with eviction on publish/update. SEO: canonical, OG, JSON-LD, sitemap, RSS/Atom.

### Backup & Restore
Format: `backup-YYYYMMDD-HHmmss.tar.gz` with `db/`, `media/`, `config.json`, `manifest.json` (hashes).  
Selective restore by post tree; dry-run + integrity via SHA256.

### APIs
Minimal APIs under `/api/admin/*` (auth+CSRF) and `/api/public/*` (throttled). Optional webhooks.

### Admin UI
Screens: Dashboard, Posts, Media, Comments, Reactions, Import, Backup/Restore, Settings.  
Editor: Markdown with toolbar/preview; sanitize on save and render.

### Security
Sanitize allowlist; CSP/HSTS/XFO/Referrer/XCTO headers; PII minimization.

### Testing
Unit (mappers, sanitize, reactions), Integration (WXR e2e), Perf (hot routes), Backup/Restore e2e.

### Operations
Dockerfile + systemd; healthz/readyz; Serilog JSON; OpenTelemetry optional.

### Extensibility
`IFileStore`, `ISearchIndex`, `IMediaProcessor`, `IAuthProviderMapper`; in-process event bus for publish/update/restore.

### Defaults
SQLite WAL; DB at `./data/blog.db` in container. Upload caps: images 10MB; comment video 50MB/90s. Rate limits: comment 5/min/IP; reaction 20/min/IP.

---

## 3) Public Site — Banner & Monthly Archive (New Requirements)

### Top Banner (Hometown Image)
- **R1. Placement & Layout**
    - A full-width banner renders at the top of all public pages (home, post, tag, category, archives).
    - Default height: 240–320px desktop, 160–200px mobile; responsive, with **focal-point cropping**.

- **R2. Admin Controls**
    - Settings → Appearance: upload/manage banner images.
    - Configure: active image, **focal point** (x/y), alt text, credit/link, overlay color & opacity (0–60%).
    - Per-post override field; falls back to global banner when unset.

- **R3. Performance & Delivery**
    - Generate responsive renditions (`srcset` 640/1024/1600/2400) plus a tiny blur-placeholder.
    - Lazy-load when off-viewport; include explicit width/height; cache aggressively and include in SSG export.

- **R4. Accessibility**
    - Alt text required; optional caption/credit visible on banner.
    - Text placed over the banner (title/breadcrumbs) must meet **WCAG 2.1 AA** contrast via overlay.

- **R5. Theming & SEO**
    - Headline and breadcrumb layers supported; auto text color for contrast.
    - Option to hide banner per template.
    - Assets live under `/media/banner/...` with cache-busting hashes.

**Acceptance Criteria**
- Switching the active banner updates across all pages on next render/export.
- Focal point remains visible on mobile aspect ratios.
- Headline over banner passes AA contrast checks in light and dark themes.

---

### Monthly Archive (Left-Side List)
- **A1. Sidebar Navigation**
    - A **Monthly Archive** block appears in the left sidebar on ≥1024px; collapsible on smaller screens.
    - Shows the last **24 months** (configurable), grouped by year; each month displays a **post count** badge.

- **A2. Archive Pages & URLs**
    - Routes: `/{yyyy}/` (year) and `/{yyyy}/{MM}/` (month).
    - Archive pages list published posts chronologically with pagination (page size configurable).

- **A3. Data & Generation**
    - Computed from `PublishedUtc`; drafts/private excluded.
    - SSG export generates static year/month pages that have posts.
    - Sitemap includes archive pages; optional **monthly RSS** at `/{yyyy}/{MM}/feed.xml`.

- **A4. Admin Controls**
    - Settings: toggle “Show archive in sidebar,” “Months to show” (6–60), and “Show counts.”
    - Option to collapse previous years by default.

- **A5. Performance**
    - Archive list cached as a small JSON or server fragment; **invalidated** on publish/unpublish or date changes.
    - Sidebar renders instantly without blocking calls.

- **A6. Accessibility & UX**
    - List uses standard links with visible focus states; keyboard-expandable year groups.
    - The current archive page highlights its corresponding month in the sidebar.

**Acceptance Criteria**
- Visiting `/2024/05/` shows only May 2024 published posts with correct counts and pagination.
- Sidebar shows only months that actually contain posts and updates within one refresh after publish/unpublish/date changes.
- Monthly RSS (if enabled) validates and includes only that month’s posts.

---

## 4) Milestones
- **M1**: Core + SSR + import basics + backup dump.
- **M2**: Media, taxonomy, RSS/sitemap, reactions.
- **M3**: Comments + moderation + anti-spam.
- **M4**: Backup/restore selective + SSG export + e2e.