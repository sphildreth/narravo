# Narravo — Backup, Restore & Purge (Right‑Sized) v1

## 1) Scope & Goals
- **Backup/Export**: Safely snapshot **posts, pages, comments, media, tags/categories, users (basic profile)**, and platform settings.
- **Restore**: Make backups actually useful by documenting and **testing a restore** into a staging DB (or a new schema) with a quick “promote” path.
- **Purge**: Provide simple, auditable **soft‑delete** by default and **hard‑delete** when needed (e.g., GDPR erasure or spam cleanup).

**Out‑of‑scope** (for now): multi‑region DR, PITR, enterprise KMS, complex 2‑person approvals.

---

## 2) Roles & Access (minimal)
- **Owner**: Can export, restore (to staging), and hard‑delete.
- **Admin/Editor**: Can export and soft‑delete within content they manage.
- **Author**: No export/restore; soft‑delete only their own content.
- **Optional**: Require re‑auth/MFA for export/restore/hard‑delete actions (recommended but not mandatory).

---

## 3) Data Sets & Relationships
- **Core**: `users`, `posts`, `pages`, `comments`, `media`, `tags`, `categories`, `post_tags`, `post_categories`, `revisions`, `redirects`, `settings`.
- **Integrity**: Exports must include join tables so slugs, tags, and categories reconnect on restore.
- **Tenant** (if you ever enable multi‑tenant): add a `tenant_id` filter to export/purge screens and CLI; otherwise single‑tenant implied.

---

## 4) Export (Backup) — Pragmatic Requirements
### 4.1 Consistency & Format
- Use **pg_dump** (custom format) for the database or a **logical dump** (`JSONL` per table) behind a repeatable‑read transaction. Choose **one** and document it.
- Media: zip/tar the `uploads/` tree; include SHA‑256 checksums per file.
- Produce an `export_manifest.json` with:
    - `appVersion`, `schemaVersion`, `createdAtUtc`, `createdByUserId`, `countsByEntity`, `exportMethod` (`pg_dump|jsonl`), `dbEngine`, `hasMedia`, `checksums` (archive & media list).

### 4.2 Packaging
- Single archive: `narravo-export-YYYYMMDD-HHmm.zip`
    - `/db/` → `dump.sql` or `*.jsonl`
    - `/media/` → uploaded files (optional)
    - `/manifest/` → `export_manifest.json`
    - `/README_RESTORE.md` → human steps (see §6).

### 4.3 Security (lightweight)
- **At least**: password‑protected archive (zip AES). Show the password once.
- Store checksum (SHA‑256) and display it in the UI after completion.
- Download links expire in **15 minutes**; limit concurrent exports per user to **1**.

### 4.4 UX & Ops
- Export screen: scope (all / date range / selected types), include media toggle, estimated size, and “start export” button.
- Job progress + “copy checksum” + “download archive” on completion.
- Optional “Send to S3/Azure Blob” destination with lifecycle (e.g., 30–90 day retention).

---

## 5) Restore — Keep It Safe & Simple
> A backup isn’t real until you’ve restored it at least once.

- **Restore target**: always a **staging database/schema** (e.g., `narravo_restore_{timestamp}`) and a temp `uploads_restore/` bucket folder.
- Steps:
    1. Upload `.zip` or pick from storage.
    2. Verify archive password (if set) and **checksum**.
    3. Validate manifest `schemaVersion`; if different, run **migrations** or abort with instructions.
    4. **Dry‑run**: show entity counts and potential conflicts (slug + unique keys).
    5. Restore DB (pg_restore or JSONL importer in batches) and sync media.
    6. Generate a **restore report** (counts, timings, warnings).
- **Promote** (optional): owner action to swap connection string or run a copy/merge into production after validation. Require one extra confirmation.

- **Redaction (optional but useful)**: when restoring to staging, obfuscate PII (emails → `user+demo@…`, names to placeholders) and **invalidate auth tokens/sessions**.

---

## 6) README_RESTORE.md (template content)
- Prereqs: psql, pg_restore (if using pg_dump), node script (if JSONL).
- Commands:
    - **pg_dump path**:
      ```bash
      createdb narravo_restore_$(date +%Y%m%d_%H%M)
      pg_restore -d narravo_restore_YYYYMMDD_HHMM db/dump.sqlc
      ```
    - **JSONL path**: `pnpm ts-node tools/jsonl-import.ts --dir db/ --dsn <restore-dsn>`
    - Media: upload/rsync to `uploads_restore/` (S3 sync example).
- Post-checks: run `pnpm prisma migrate deploy` (or Drizzle `drizzle-kit migrate`) if needed; run `tools/slugs-verify.ts` to list conflicts.

---

## 7) Purge (Delete) — Sensible Defaults
- **Soft‑delete** by default: add `deleted_at` (and `deleted_by`) on `posts/pages/comments/media`. Filter these out of all queries.
- **Hard‑delete** guarded flows:
    - Require **owner re‑auth** (password or MFA), a typed phrase (`DELETE <type> <slug|id>`), and a final confirm.
    - Provide **dry‑run counts** (e.g., “This will remove 1 post, 7 comments, 2 media links”). Show slug/ids.
    - Spam cleanups: bulk hard‑delete by filter (`created_at < X`, `authorId in (…)`, `status = spam`).

- **Cascade rules** (keep simple):
    - Deleting a **post/page** removes **comments** linked to it.
    - Orphaned **media** (no references) can be auto‑cleaned by a scheduled job (see §10).

- **GDPR/Erasure for a user**:
    - Option A (preferred): anonymize author fields and delete their comments content body, keeping counts for analytics.
    - Option B: full hard‑delete (author, posts, comments, media) when legally required.

---

## 8) Minimal Audit & Logs
- Log **who/what/when** for export/restore/hard‑delete (user id, IP if available).
- Store the **export id** ↔ archive filename, checksum, and scope.
- Keep these logs in the primary DB (simple) with a 180‑day retention.

---

## 9) API & CLI (thin)
- `POST /admin/export` → starts job `{ includeMedia, dateFrom?, dateTo? }`.
- `GET /admin/export/:id` → status, checksum, download URL.
- `POST /admin/restore` → staging restore from file/storage key.
- `POST /admin/purge` → `{ type, id|slug|filter, mode: soft|hard, dryRun: true }`.
- **CLI** (nice to have): `pnpm narravo export|restore|purge` to call the same endpoints with service token.

---

## 10) Scheduled Housekeeping (optional, very useful)
- **Media GC**: weekly job that deletes files not referenced by any record for >7 days.
- **Soft‑delete sweeper**: permanently hard‑delete items with `deleted_at < now()-interval '30 days'` (configurable).

---

## 11) Acceptance Criteria (pragmatic)
- Export produces a **single archive** with manifest + (optional) media, and a checksum.
- Restore to staging completes and the site boots with expected counts and working slugs.
- Soft‑delete hides content from public APIs and admin lists by default.
- Hard‑delete requires re‑auth + typed confirmation and shows correct dry‑run counts.
- A 500k‑row comment table export/restore completes within a practical window (document your target, e.g., **<30 min** on your hardware).

---

## 12) Implementation Notes
- Prefer **pg_dump custom format** for simplicity and speed; JSONL importer is fine if you already have tooling.
- If hosting media on **S3/Backblaze**, use `aws s3 sync`/`b2 sync` in export/restore scripts.
- Keep `schemaVersion` = app migration version (Prisma migrations folder hash / Drizzle snapshot). Bump when breaking changes occur.
- Provide a tiny **React admin UI**: Export (scope + include media), Restore (upload + staging target), Purge (search + soft/hard tabs) with a simple history list.
- Add unit tests for manifest generation and slug conflict detection; one E2E “export→restore” CI test per release is enough.

---

## 13) Files & Examples
- `tools/export.ts` (wraps pg_dump + media zip + manifest)
- `tools/restore.ts` (verifies checksum, stages DB, imports, media sync)
- `tools/jsonl-import.ts` (optional)
- `docs/templates/README_RESTORE.md` (generated into the archive)
- **Manifest Example**:
  ```json
  {
    "appVersion": "0.14.0",
    "schemaVersion": "2025-09-20_07",
    "createdAtUtc": "2025-09-23T18:15:00Z",
    "createdByUserId": "owner_123",
    "exportMethod": "pg_dump",
    "countsByEntity": {"posts": 241, "comments": 1264, "media": 903},
    "hasMedia": true,
    "checksumSha256": "…"
  }
  ```

---

## 14) Nice‑to‑Have (later)
- One‑click “Download content only” (no users/sessions).
- Passwordless short‑lived session just for downloading the finished archive.
- Snapshot from a **read‑replica** if available.
