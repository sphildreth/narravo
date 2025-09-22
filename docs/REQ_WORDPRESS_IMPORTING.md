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
	- Import wp:comment elements for published posts only.
	- Map comment status: approve -> "approved", hold -> "pending", spam/trash -> skipped (not imported).
	- Preserve nesting using parent comment IDs; store as materialized path (comments.path) and depth per existing convention.
	- Author mapping: where email is present, upsert users by email with name=display_name; otherwise userId=null.
	- Copy comment dates into createdAt if present.
	- Sanitize comment body to bodyHtml; bodyMd may be null.
- Redirects: create 301 redirects from each post's item.link path to /posts/{slug}. Update existing redirects on conflict.
- Internal links: in post content, rewrite internal WordPress post URLs to the new /posts/{slug} when possible. Fallback: leave original and rely on redirects.
- Media:
	- Process wp:post_type=attachment entries first. Download original files when S3/R2 is configured; dedupe with SHA256; upload with public URL.
	- Rewrite content URLs for media: replace occurrences in src, href, and srcset attributes. Maintain a mapping old->new URL.
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
- Idempotency: dedupe by posts.guid and media content hash; re-import updates post title/excerpt/publishedAt/html but will not overwrite bodyMd.

Security
- Admin-only access to the UI and server actions.
- Media download host allowlist; redact credentials in logs; rate-limit admin action.
- Skip <script> and unsafe attributes; only allow known iframe sources (e.g., YouTube) per global sanitizer policy.

Observability
- Structured logs per job with counts and timings.
- Persist summary and detailed errors; surface errors in the Admin UI with search and pagination.

# Acceptance Criteria

- Admins can upload a valid WXR and run an import from the UI with visible progress.
- Admins can select which post statuses to import.
- Optionally purge existing content prior to import; after purge, DB tables (posts, comments, post_tags, tags, categories, redirects) are empty.
- After import:
	- Posts (with selected statuses) exist with correct titles, slugs, excerpts, bodyHtml/html, publishedAt, guid, and are assigned to the correct (potentially new) author.
	- **Featured images are correctly imported, whether referenced by URL or attachment ID.**
	- Primary category is set when at least one category exists; tags are attached via post_tags.
	- Comments for imported posts exist with correct nesting, sanitized bodyHtml, statuses mapped, and createdAt.
	- Redirects exist from original WP paths to /posts/{slug}.
	- Internal links to other posts are rewritten where a target slug is known.
	- Media attachments are downloaded (when enabled), uploaded to S3/R2, and referenced URLs in content are rewritten.
- Cancelling stops the job within a bounded delay and marks it cancelled with a checkpoint; retry resumes without duplicating content.
- **Detailed, item-level errors are logged and viewable in the Admin UI.**

# Notes on Current Implementation Alignment

- The importer exists at scripts/import-wxr.ts and will be invoked by Admin server actions. It supports GUID idempotency, attachment processing, media SHA256 dedupe, content URL rewriting, and redirect creation. Checkpointing and summaries are surfaced in Admin.
- Schema alignment:
	- `posts.guid` exists for idempotency; `bodyMd` is nullable; `bodyHtml/html` are used for rendered HTML. A `userId` field on `posts` must be populated.
	- categories, tags, and post_tags exist; posts has a single categoryId. We will flatten categories and pick a primary category.
	- comments schema supports path/depth and userId; statuses are free text; we will use "approved"/"pending".
	- redirects table exists and supports unique fromPath with upsert.
	- New tables `import_jobs` and `import_job_errors` will be required.

# Follow-ups (Post-MVP)

- WordPress pages and custom post types.
- Shortcode processing for common blocks (gallery, audio, etc.).
- Streaming XML parsing for very large WXR files.
- Full user import with role mapping.
- SEO meta import.
- A robust CLI for initiating and managing imports.


CLI
- Out of scope for MVP. Import is triggered from Admin only. A future iteration may add a CLI runner with flags such as --concurrency, --allow-host, and --purge.

Core Data Mapping
- Posts: import only wp:post_type=post with wp:status=publish; set fields title, slug (with collision-safe fallback), guid, excerpt, bodyHtml/html, publishedAt. Do not set bodyMd.
	- Featured image: if present in WXR metadata (e.g., `_thumbnail_url`, `_wp_attachment_image_alt`), set `posts.featured_image_url` and `posts.featured_image_alt`. If only attachment ID is provided, skip for MVP and leave for follow-up.
- Taxonomy:
	- Create categories and tags from item <category> elements: domain="category" -> categories; domain="post_tag" -> tags. Slugs are lowercased, URL-safe, unique.
	- Each post may have multiple categories/tags. Because schema supports one primary category (posts.categoryId) plus many tags (post_tags), choose a primary category:
		- If multiple categories, pick the first category term encountered as primary.
		- Store all tags via post_tags junction table.
	- WordPress hierarchical categories are flattened (no parentId in schema). Keep slugs unique; store only leaf names as-is.
- Comments:
	- Import wp:comment elements for published posts only.
	- Map comment status: approve -> "approved", hold -> "pending", spam/trash -> skipped (not imported).
	- Preserve nesting using parent comment IDs; store as materialized path (comments.path) and depth per existing convention.
	- Author mapping: where email is present, upsert users by email with name=display_name; otherwise userId=null.
	- Copy comment dates into createdAt if present.
	- Sanitize comment body to bodyHtml; bodyMd may be null.
- Redirects: create 301 redirects from each post's item.link path to /posts/{slug}. Update existing redirects on conflict.
- Internal links: in post content, rewrite internal WordPress post URLs to the new /posts/{slug} when possible. Fallback: leave original and rely on redirects.
- Media:
	- Process wp:post_type=attachment entries first. Download original files when S3/R2 is configured; dedupe with SHA256; upload with public URL.
	- Rewrite content URLs for media: replace occurrences in src, href, and srcset attributes. Maintain a mapping old->new URL.
	- Respect allowed-host whitelist; skip/flag external hotlinks to other domains unless allowed.
	- If media is skipped (no S3), content stays unchanged; import still succeeds.

Progress, Cancel, Retry
- Persist job records in a new import_jobs table with: id, status (queued|running|cancelling|cancelled|failed|completed), file name, options (JSON), counters (totalItems, postsImported, attachmentsProcessed, redirectsCreated, skipped), startedAt, updatedAt, finishedAt, error summary, and optional checkpoint file path.
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
- Idempotency: dedupe by posts.guid and media content hash; re-import updates post title/excerpt/publishedAt/html but will not overwrite bodyMd.

Security
- Admin-only access to the UI and server actions.
- Media download host allowlist; redact credentials in logs; rate-limit admin action.
- Skip <script> and unsafe attributes; only allow known iframe sources (e.g., YouTube) per global sanitizer policy.

Observability
- Structured logs per job with counts and timings.
- Persist summary and errors; surface last 100 errors in Admin UI.

# Acceptance Criteria

- Admins can upload a valid WXR and run an import from the UI with visible progress.
- Optionally purge existing content prior to import; after purge, DB tables (posts, comments, post_tags, tags, categories, redirects) are empty.
- After import:
	- Published posts exist with correct titles, slugs, excerpts, bodyHtml/html, publishedAt, and guid.
	- Primary category is set when at least one category exists; tags are attached via post_tags.
	- Comments for imported posts exist with correct nesting, sanitized bodyHtml, statuses mapped, and createdAt.
	- Redirects exist from original WP paths to /posts/{slug}.
	- Internal links to other posts are rewritten where a target slug is known.
	- Media attachments are downloaded (when enabled), uploaded to S3/R2, and referenced URLs in content are rewritten.
- Cancelling stops the job within a bounded delay and marks it cancelled with a checkpoint; retry resumes without duplicating content.

# Notes on Current Implementation Alignment

- The importer exists at scripts/import-wxr.ts and will be invoked by Admin server actions. It supports GUID idempotency, attachment processing, media SHA256 dedupe, content URL rewriting, and redirect creation. Checkpointing and summaries are surfaced in Admin.
- Schema alignment:
	- posts.guid exists for idempotency; bodyMd is nullable; bodyHtml/html are used for rendered HTML.
	- categories, tags, and post_tags exist; posts has a single categoryId. We will flatten categories and pick a primary category.
	- comments schema supports path/depth and userId; statuses are free text; we will use "approved"/"pending".
	- redirects table exists and supports unique fromPath with upsert.

# Follow-ups (Post-MVP)

- WordPress pages and custom post types.
- Attachment ID→URL resolution for featured images using _thumbnail_id relation and SEO meta import.
- Shortcode processing for common blocks (gallery, audio, etc.).
- Streaming XML parsing for very large WXR files.
- Import authors as users and ownership mapping for posts (requires posts.userId).