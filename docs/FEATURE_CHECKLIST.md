# Narravo — Feature Checklist

### Marking Complete
- Items that are fully implemented will be marked as complete with "X"
- Items that are partially implemented will be marked as partially complete with "-"
    - Add a note under the partially implemented item providing some detail to what has been completed and what is pending

---

### Discovery & Navigation
- [X] Site‑wide search (typo‑tolerant)
- [X] Tag & category pages; archive by month/year
- [-] Related/next/previous; series navigation
    - Next/previous post navigation fully implemented; series/collections not implemented
- [X] "Popular" (time‑bounded) and "Recent" modules
- [-] RSS/Atom/JSON Feed; email subscribe
    - RSS/Atom feeds fully implemented (main and monthly archives); email subscribe not implemented
- [ ] Social share buttons
- [X] Pagination or infinite scroll with real URLs implemented will be marked as complete with "X"

---

### Discovery & Navigation
- [X] Site‑wide search (typo‑tolerant)
- [X] Tag & category pages; archive by month/year
- [ ] Related/next/previous; series navigation
- [-] "Popular" (time‑bounded) and "Recent" modules
    - Trending posts widget with view aggregation implemented
- [-] RSS/Atom/JSON Feed; email subscribe
    - RSS/Atom feeds fully implemented (main and monthly archives); email subscribe not implemented
- [ ] Social share buttons
- [X] Pagination or infinite scroll with real URLs** One owner/author writes and publishes all posts. Visitors can react and com## 9) Portability & Longevity

- [X] Import from WordPress (WXR) and Markdown folders
- [X] Export all posts/media as Markdown + assets
- [-] JSON/CSV export for comments & subscribers
    - JSON export implemented; CSV export not specifically implemented
- [X] Stable, clean URLs (no lock‑in identifiers)
- [-] "Evergreen updates" pattern (clearly mark updated posts)
    - Posts have updatedAt timestamps; no explicit "updated" badge UIut ## 10) Nice‑to‑Have Polish (Single‑Author Extras)

- [ ] OG image generator (templated per‑post hero)
- [ ] Reading position resume per visitor (local storage)
- [ ] Webmentions/IndieWeb (optional)
- [-] "Now/Uses/Bookshelf" pages with lightweight CMS blocks
    - Disclaimer and About Me pages with CMS-like editing exist
- [-] Site search index built at publish time
    - Database-backed full-text search implemented
- [ ] Offline‑readable pages (PWA lite) — optionalreate posts. This reduces multi‑author workflows and shifts emphasis to writing ergonomics, curation, audience growth, moderation, and long‑term maintainability.

---

## 1) Authoring (You, the Blog Owner)

### Writing Ergonomics
- [X] Lightweight editor with Markdown shortcuts (+ toolbar)
- [X] Code blocks with syntax highlighting & **Copy** button
- [-] Tables, callouts/alerts, footnotes, task lists
    - Tables and task lists fully implemented; callouts/alerts and footnotes not implemented
- [X] Media: drag‑drop image upload, paste from clipboard
- [-] Image captions & **alt** text; basic crop & focal point
    - Alt text enforced; featured image focal point implemented; general image cropping and captions in editor not fully implemented
- [-] Safe embeds via allow‑list (YouTube/Vimeo/CodePen, etc.)
    - Video shortcode with safe URL validation implemented; general iframe allowlist exists
- [-] Optional: Math (KaTeX) and Diagrams (Mermaid)
    - Mermaid diagrams fully implemented; KaTeX infrastructure exists but not complete
- [ ] TOC generator and stable heading anchors
- [ ] Quick internal linking (search existing posts by title/slug)

### Drafting & Publishing
- [-] Autosave (≤ 5s) and local crash recovery
    - Editor onChange fires immediately; explicit 5-second timer not implemented
- [ ] Version history (diff + restore) — single‑author but still valuable
- [-] Preview (desktop/tablet/phone) that mirrors production styles
    - Markdown view toggle exists; device-specific preview not implemented
- [X] Schedule publish; update vs. preserve original publish date
- [ ] Visibility: public / unlisted / private / password
- [-] Post states: Draft → Published → Archived
    - Draft and Published states exist; Archived state not implemented
- [ ] Custom canonical URL (for cross‑posting)

### Content Modeling
- [X] Title, slug, excerpt/summary
- [X] Hero/featured image
- [X] Tags & categories (with descriptions/cover images)
- [ ] Series/collections & ordered reading lists
- [ ] Related posts (auto + manual pinning)
- [-] Per‑post custom components/shortcodes (sandboxed)
    - Video shortcode implemented with sanitization
- [ ] Per‑post custom CSS/JS (guardrails) — optional

---

## 2) Reader Experience (Visitors)

### Reading
- [X] Great typography (line length/height); fast first paint
- [X] Light/dark mode (respects system + manual toggle)
- [ ] Estimated reading time; optional reading‑progress bar
- [ ] Anchored headings; footnote popovers
- [ ] Image zoom/lightbox with captions
- [X] Responsive, privacy‑enhanced video embeds
- [X] Code blocks with copy and optional line numbers

### Discovery & Navigation
- [ ] Site‑wide search (typo‑tolerant)
- [ ] Tag & category pages; archive by month/year
- [ ] Related/next/previous; series navigation
- [ ] “Popular” (time‑bounded) and “Recent” modules
- [ ] RSS/Atom/JSON Feed; email subscribe
- [ ] Social share buttons
- [ ] Pagination or infinite scroll with real URLs

### Interactions (No User Posting)
- [X] Reactions (like/emoji), rate‑limited, anonymous or account‑optional
- [X] Comments with moderation & anti‑spam
- [-] Privacy‑respecting avatars (e.g., generated/Gravatar opt‑in)
    - OAuth provider avatars used; no custom avatar generation
- [ ] Print‑friendly view
- [-] Localized dates & number formats (i18n/RTL‑ready)
    - Configurable date format implemented; full i18n/RTL not implemented

---

## 3) Audience Growth (Solo Publisher Needs)

- [ ] Newsletter capture with double opt‑in (exportable list)
- [ ] Digest emails (weekly/monthly) from recent posts
- [ ] Web Subscriptions: WebSub/PubSubHubbub (optional)
- [ ] Social syndication helpers (copyable OG text, thread draft)
- [-] UTM helpers for campaign links
    - Analytics tracks UTM parameters and referrers
- [ ] Basic sponsorship/affiliate disclosure block (optional)
- [ ] Micro‑updates/Notes post type (short‑form) — optional

---

## 4) SEO & Social

- [-] Per‑post meta title & description
    - Metadata generated from post title/excerpt; no custom override UI
- [-] Open Graph & Twitter cards (og:image generator preferred)
    - OG and Twitter cards fully implemented; automatic image generator not implemented
- [X] Structured data (Article/BlogPosting JSON‑LD)
- [X] Automatic sitemaps; robots.txt
- [X] Canonical link tag; per‑post noindex/nofollow controls
- [ ] Link checker (scheduled) for internal & external links

---

## 5) Media Pipeline

- [-] Responsive images (`srcset/sizes`), AVIF/WebP
    - Next.js Image component supports srcset, WebP, AVIF; not enforced everywhere
- [-] Lazy‑load with LQIP/blur‑up
    - Native lazy loading supported; LQIP not implemented
- [-] Media library with search & reuse
    - Media uploaded to S3/R2 or local storage; no dedicated browsing/search UI
- [ ] EXIF strip (privacy) with opt‑in keep GPS = off by default
- [ ] Image deduplication & automatic resizing rules

---

## 6) Privacy, Security & Compliance

- [X] Role‑based access (single Admin/Owner account)
- [ ] Two‑Factor Authentication (2FA) for the owner
- [X] Strong CSP, XSS/CSRF protections, rate limiting, CAPTCHA where needed
- [X] Spam defense (Akismet/HCaptcha/Honeypots); moderation queue
- [X] Minimal, privacy‑respecting analytics (Plausible/umami or self‑hosted)
- [ ] Cookie banner only if legally required
- [X] Data export for subscribers/comments; delete‑on‑request
- [X] Backups with test restore (posts, media, config)

---

## 7) Performance & Delivery

- [X] CDN caching for pages & assets
- [X] HTTP/2 or HTTP/3; Brotli/Gzip compression
- [X] ETags/Last‑Modified; proper cache‑control
- [-] Prefetch/prerender likely next pages
    - Next.js Link component provides prefetching
- [ ] Background image transforms & uploads queue (optional)

---

## 8) Admin & Operations (Solo‑Friendly)

- [X] Clean dashboard: drafts, scheduled posts, top referrers
- [X] Comment moderation center (approve/ban/filters)
- [X] Redirect manager (301/302) esp. after slug changes
- [-] Webhooks/integrations (newsletter, analytics, search indexer)
    - WordPress import with resumable jobs; no general webhook system
- [ ] Error monitoring & tracing (alerting via email)
- [-] Scheduled jobs for feeds, sitemaps, digests, link checks
    - Sitemaps/feeds generated on-demand with ISR; no scheduled digest emails
- [ ] Maintenance mode (graceful downtime page)

---

## 9) Portability & Longevity

- [ ] Import from WordPress (WXR) and Markdown folders
- [ ] Export all posts/media as Markdown + assets
- [ ] JSON/CSV export for comments & subscribers
- [ ] Stable, clean URLs (no lock‑in identifiers)
- [ ] “Evergreen updates” pattern (clearly mark updated posts)

---

## 10) Nice‑to‑Have Polish (Single‑Author Extras)

- [ ] OG image generator (templated per‑post hero)
- [ ] Reading position resume per visitor (local storage)
- [ ] Webmentions/IndieWeb (optional)
- [ ] “Now/Uses/Bookshelf” pages with lightweight CMS blocks
- [ ] Site search index built at publish time
- [ ] Offline‑readable pages (PWA lite) — optional

---

## MVP for a Single‑Author Launch

- [X] Editor + media/embeds + autosave
- [-] Draft → publish with preview
    - Draft/publish workflow exists; full preview not implemented
- [-] Tags/categories, related posts, archives
    - Tags/categories and archives fully implemented; related posts not implemented
- [X] SEO basics (title/description/OG/canonical) + sitemap + RSS
- [X] Image optimization (responsive + lazy)
- [X] Search + recent posts
- [X] Comments (moderated) + reactions
- [X] Dark mode
- [X] Privacy‑friendly analytics
- [X] Backups + restore test

---

## Sample Acceptance Criteria (Tailored)

- [-] **Autosave:** Edits are persisted within 5s and survive tab crash/refresh.
    - Editor onChange fires immediately; explicit 5s timing not implemented
- [-] **Responsive images:** Largest delivered image ≤ 1.25× display width; `srcset` present.
    - Next.js Image component handles this where used
- [X] **SEO meta:** Published posts include `<title>`, `<meta name="description">`, `og:image`, and canonical URL.
- [X] **Search quality:** With a typo (edit distance ≤ 2), intended post appears in top 3.
- [X] **Comment safety:** New comments are queued when anti‑spam score is high; bulk approve/ban works; rate limiting enforced.
- [X] **Accessibility:** All interactive elements keyboard‑operable; no critical axe‑core violations.
