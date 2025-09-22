# Overview 

Define the product and technical requirements to import WordPress WXR (WordPress eXtended RSS) exports into Narravo. This includes posts, media, redirects, taxonomy (categories/tags), featured images, and comments, with an Admin workflow for uploading, running, monitoring, cancelling, and retrying imports. MVP is Admin-only (no CLI). 

# Scope 
- Input: One or more WXR XML files exported from WordPress. We do not require bundled uploads/ZIPs; media is fetched from original URLs.
- Output: Narravo posts with sanitized HTML; optional S3/R2-hosted media; categories, tags, featured images, and comment threads mapped; 301 redirects from old WordPress URLs; import job records with progress. 
- Non-goals (MVP): WordPress pages/custom post types, shortcodes expansion, SEO meta, and WordPress users/roles migration beyond basic author/commenter mapping.


# Requirements 

# Overview 
Define the product and technical requirements to import WordPress WXR (WordPress eXtended RSS) exports into Narravo. This includes posts, media, redirects, taxonomy (categories/tags), featured images, and comments, with an Admin workflow for uploading, running, monitoring, cancelling, and retrying imports. MVP is Admin-only. 

# Scope 
- Input: One or more WXR XML files exported from WordPress. We do not require bundled uploads/ZIPs; media is fetched from original URLs.
- Output: Narravo posts with sanitized HTML; optional S3/R2-hosted media; categories, tags, featured images, and comment threads mapped; 301 redirects from old WordPress URLs; import job records with progress. 
- Non-goals (MVP): WordPress pages/custom post types, shortcodes expansion, SEO meta, and full WordPress users/roles migration. Basic author/commenter mapping is included.

# Requirements
Admin UI
- A System -> Import page under Admin (admins only).
- Upload a WXR (.xml) file and choose options:
  - **Import post statuses**: A multi-select dropdown to choose which post statuses to import (e.g., `publish`, `draft`, `pending`, `private`), defaulting to `publish`.
  - Purge before import: delete all posts, comments, post_tags, tags, categories, and redirects. Runs in a transaction envelope per table group; confirms destructive action.
  - Dry run: parse and plan without DB writes or media uploads.
  - Skip media downloads.
  - Concurrency limit for media downloads (default 4-8).
  - Allowed media host(s) whitelist (defaults to the WXR site host).
- Start import and view progress in real time: items total/processed, posts imported, attachments processed, redirects created, skipped, errors count.
- Cancel an in-flight import gracefully.
- Retry a failed/stopped import (resume from last checkpoint if available).
- A searchable, paginated view of detailed import errors.

CLI
- Out of scope for MVP, but highly recommended for robust, long-running imports. A future iteration must add a CLI runner with flags such as --concurrency, --allow-host, --purge, and --statuses.

Core Data Mapping
- Posts: import `wp:post_type=post` with statuses selected in the UI. Set fields title, slug (with collision-safe fallback), guid, excerpt, bodyHtml/html, publishedAt. Do not set bodyMd.
- **Author Mapping**: Map post author via the `<dc:creator>` field. Upsert a user by login name, creating a placeholder user account if one does not exist. Assign the post to this user.
- **Featured Image**: The importer must handle featured images referenced by `_thumbnail_id` in post metadata. This requires a two-pass approach:
  1. First pass: Process all `wp:post_type=attachment` items to build an in-memory map of attachment ID to its public URL.
  2. Second pass: When processing posts, use the `_thumbnail_id` to look up the URL from the map and set `posts.featured_image_url` and `posts.featured_image_alt`. If a `_thumbnail_url` is also present, it can be used as a fallback.
- Taxonomy:
  - Create categories and tags from item <category> elements: domain="category" -> categories; domain="post_tag" -> tags. Slugs are lowercased, URL-safe, unique.
  - Each post may have multiple categories/tags. Because schema supports one primary category (posts.categoryId) plus many tags (post_tags), choose a primary category:
    - If multiple categories, pick the first category term encountered as primary.
  - Store all tags via post_tags junction table.
  - WordPress hierarchical categories are flattened (no parentId in schema). Keep slugs unique; store only leaf names as-is.
- Comments:
  - Import `wp:comment` elements for published posts only.
  - Map comment status: approve -> "approved", hold -> "pending", spam/trash -> skipped (not imported).
  - Preserve nesting using parent comment IDs; store as materialized path (`comments.path`) and depth per existing convention.
  - Author mapping: where email is present, upsert users by email with name=display_name; otherwise `userId=null`.
  - Copy comment dates into createdAt if present.
  - Sanitize comment body to bodyHtml; bodyMd may be null.
- Redirects: create 301 redirects from each post's `item.link` path to `/posts/{slug}`. Update existing redirects on conflict.
- Internal links: in post content, rewrite internal WordPress post URLs to the new `/posts/{slug}` when possible. Fallback: leave original and rely on redirects.
- Media:
  - Process `wp:post_type=attachment` entries first. Download original files when S3/R2 is configured; dedupe with SHA256; upload with public URL.
  - Rewrite content URLs for media: replace occurrences in `src`, `href`, and `srcset` attributes. Maintain a mapping old->new URL.
  - Respect allowed-host whitelist; skip/flag external hotlinks to other domains unless allowed.
  - If media is skipped (no S3), content stays unchanged; import still succeeds.

Progress, Cancel, Retry
- Persist job records in a new `import_jobs` table with: id, status (queued|running|cancelling|cancelled|failed|completed), file name, options (JSON), counters (totalItems, postsImported, attachmentsProcessed, redirectsCreated, skipped), startedAt, updatedAt, finishedAt, and a summary of errors.
- **Detailed Error Logging**: For each skipped or failed item, log the item identifier (e.g., post GUID), the reason for failure (e.g., "Media download failed: 404 Not Found"), and the relevant data. These logs should be stored in a separate `import_job_errors` table, linked to the parent job.
- While running, store periodic checkpoints to disk (already supported) and update aggregate counters in DB.
- Cancel requests set a cancelling flag; the importer checks between items and exits cleanly, saving checkpoint and marking job cancelled.
- Retry will resume from last checkpoint if present, otherwise restart.

Validation & Sanitization
- Validate XML can be parsed; reject empty/invalid files with clear error messages.
- Sanitize all imported HTML (posts and comments) server-side with our sanitizer defaults.
- Enforce slug uniqueness with a deterministic fallback (append -1, -2, ...).

Performance & Robustness
- Stream or chunk processing where possible; do not load entire WXR into memory for very large files (target >100k items). Batch DB writes when safe.
- Limit concurrent media downloads; set reasonable HTTP timeouts and retries. Record bytes and mime when available.
- Idempotency: dedupe by `posts.guid` and media content hash; re-import updates post title/excerpt/publishedAt/html but will not overwrite bodyMd.

Security
- Admin-only access to the UI and server actions.
- Media download host allowlist; redact credentials in logs; rate-limit admin action.


---

# Addendum: Robust Import Requirements (MVP hardening)

> The following additions close common WXR edge-cases and raise import success rates on large, real-world sites.

## Input & Parser Safety
- Accept **`.xml` and `.xml.gz`**. If gzipped, stream-decompress to avoid large memory spikes.
- Use a **streaming SAX-style** parser (do not load entire XML). Disable DTDs/XXE: external entities and network fetches are forbidden.
- Normalize to **UTF-8**; reject or transcode files with mismatched encodings.

## Dates & Timezones
- Prefer WordPress `*_gmt` fields (`wp:post_date_gmt`, `wp:comment_date_gmt`) when present; otherwise convert local site time to UTC (use WXR site timezone if available).
- Preserve original local timestamps for audit; sort archives by normalized UTC.

## Post/Status Nuances
- Handle **password-protected** (`post_password`) and **private** posts:
  - MVP: import with flags (`isProtected`, `isPrivate`) and **do not publish** publicly by default.
- Stickies (`wp:is_sticky`) and post formats: store as metadata for fidelity (UI may ignore in MVP).

## Comments
- Respect `wp:comment_type`: `"" | pingback | trackback`. MVP policy: **import standard comments**, **skip pingbacks/trackbacks**, but record counts.
- When a `comment_parent` is missing (deleted/not exported), re-parent to **root** and log.
- Map statuses: approve → `approved`, hold → `pending`, spam/trash → **skip**.

## Authors & Users
- Posts: upsert author by **login**; fallback to **email** if login missing.
- Comments: upsert by **email** when present; never log raw emails—mask or hash for logs.
- MVP explicitly **does not auto-link** to OAuth identities; document manual linking for later.

## Media & Attachments
- Pull `_wp_attachment_image_alt` into `featured_image_alt`.
- Enforce **max file size** and **allowed mime types**; compute **SHA256** before upload and dedupe across runs.
- Cap in-flight downloads; add per-host rate-limit and exponential backoff.
- If an attachment URL 404s/timeouts, continue import, record error, leave original URL in content.

## Internal Links & Redirects
- Create redirects from old post URLs to `/posts/{slug}` with **canonicalization**:
  - Normalize scheme (http→https), strip/keep `www` consistently, unify trailing slashes.
- Rewrite internal links **only when the target was imported**; otherwise keep original and rely on redirect.
- Include `srcset` URL rewrites where possible.
- Emit a **rewrite report**: number rewritten vs. left as-is.

## Taxonomy
- Keep **term + taxonomy** uniqueness; normalize slug case-folding.
- Store original `term_id` / `term_taxonomy_id` for traceability (even if UI flattens hierarchy).

## Idempotency & Update Semantics
- Primary identity: `guid` + `post_type`. On re-import:
  - Update title, excerpt, publishedAt, html; **do not change slug** by default.
  - If slug change is forced, generate a **new redirect** from old to new slug and warn.

## Dry-run & Pre-flight
- Dry-run returns a **plan**: counts by type (posts/comments/attachments), top new terms, estimated media bytes, potential slug collisions.
- Pre-flight validates DB connectivity/constraints, bucket credentials, and allowed-hosts before starting.

## Security & PII
- Sanitize **both posts and comments** using an allowlist (tags/attrs incl. `img[src|srcset|sizes|alt]`, `a[href|rel|target]`, `code`, `pre`, `blockquote`, `figure`, `figcaption]`).
- Block `javascript:` URLs and disallow `data:` except safe images if required.
- Never log full commenter emails/IPs; mask or hash in error logs.

## Observability
- Persist per-job metrics: throughput, bytes downloaded, failures by reason, retries, last checkpoint offset.
- Configurable **HTTP timeouts**, **max retries**, and **concurrency**.

## Testing & Fixtures
- Provide three test fixtures:
  1) **Tiny**: 2 posts, nested comments, one featured image.
  2) **Medium**: ~100 posts, mixed statuses, multiple categories/tags, a few missing attachments.
  3) **Edge**: shortcodes, pingbacks, password-protected posts, duplicate slugs, mixed encodings.
- Include golden counts and at least one known internal link that must be rewritten.

## Acceptance Criteria (MVP)
- A single large WXR (≥200 MB) imports without OOM; dry-run surfaces a clear plan.
- Post counts in DB match expected items for selected statuses.
- Nested comments render correctly; pending/spam are not visible.
- Featured images appear where `_thumbnail_id` was set.
- Internal links to imported posts are rewritten; others resolve via redirects.
- Re-running import is **idempotent** (no duplicates); changing a post title updates the existing row.

---

# Checklist (copy into the doc as a section)
- [ ] Accept `.xml` + `.xml.gz`, streaming parser, XXE disabled
- [ ] Use `*_gmt` dates; timezone normalization
- [ ] Policy for password-protected/private posts
- [ ] Comment types (skip pingbacks/trackbacks, log)
- [ ] Media: alt text source, size/mime limits, hash-dedupe, missing-file behavior
- [ ] Canonical redirects; `srcset` rewrites; rewrite report
- [ ] Dry-run plan & pre-flight validation
- [ ] PII-safe logging and sanitizer allowlist
- [ ] Fixtures & golden tests
