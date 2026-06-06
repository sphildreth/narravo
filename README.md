<!-- SPDX-License-Identifier: Apache-2.0 -->
# Narravo

![Narravo Logo](./public/images/logo-60x57.png)

Narravo is a self-hostable blog engine built with Next.js App Router, React, TypeScript, PostgreSQL, Drizzle ORM, and Auth.js. It powers a personal blog while also providing admin workflows for publishing, moderation, imports, analytics, backups, and site configuration.

[![CI](https://github.com/sphildreth/narravo/actions/workflows/ci.yml/badge.svg)](https://github.com/sphildreth/narravo/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
![Version](https://img.shields.io/badge/version-1.0.1-blue)
![Node](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11.5.2-f69220?logo=pnpm&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white)

Demo site: [Knowledge Tome](https://www.shildreth.com)

## Features

- Next.js 16 App Router with Server Components, Server Actions, ISR, and route handlers.
- React 19 and TypeScript 6 with strict type checking.
- PostgreSQL 16 with Drizzle ORM migrations and type-safe queries.
- Auth.js OAuth login with GitHub and Google provider support.
- Admin allowlist through `ADMIN_EMAILS`.
- Required 2FA for admin workflows, with TOTP, WebAuthn/passkeys, recovery codes, trusted devices, and security activity logging.
- Admin dashboards for posts, comments, users, security, configuration, imports, data operations, and analytics.
- Markdown/Tiptap editing with sanitized HTML, image/video uploads, Mermaid rendering, syntax highlighting, and excerpt generation.
- Threaded comments with moderation, reactions, upload attachments, honeypots, and rate limiting.
- AWS S3, S3-compatible storage, Cloudflare R2, or local `public/uploads` media storage.
- WordPress WXR import with resumable jobs, media rewriting, offline upload-folder imports, redirects, comments, categories, and tags.
- Backup/export, restore preview, purge workflows, and data-operation audit logs.
- Privacy-aware page/post analytics, bot filtering, Core Web Vitals collection, Server-Timing headers, and performance scripts.
- Docker-based local PostgreSQL and Docker production image support.

## Requirements

- Node.js 22.13 or newer.
- Corepack with pnpm 11.5.2, as declared by `packageManager` in [package.json](./package.json).
- PostgreSQL 16 or compatible PostgreSQL service.
- Docker and Docker Compose if you want the provided local database.
- At least one configured OAuth provider for admin sign-in: GitHub, Google, or both.

## Quick Start

```bash
# Enable the pnpm version declared in package.json
corepack enable

# Start the local PostgreSQL database
docker compose up -d db

# Install dependencies
pnpm install

# Configure local environment
cp .env.example .env
# Edit .env before continuing.
# Required: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_EMAILS.
# Recommended: ANALYTICS_IP_SALT.
# Admin login also needs GITHUB_ID/GITHUB_SECRET or GOOGLE_ID/GOOGLE_SECRET.

# Create/update database tables
pnpm drizzle:migrate

# Seed required runtime configuration defaults
pnpm seed:config

# Optional demo content
pnpm seed:posts

# Start the development server
pnpm dev
```

Open <http://localhost:3000>. Public pages are available without signing in. Admin pages are under `/admin`; the signed-in email must be listed in `ADMIN_EMAILS`.

First admin setup:

1. Sign in through a configured OAuth provider.
2. Go to `/admin/security`.
3. Enable TOTP or a WebAuthn/passkey credential.
4. Store recovery codes somewhere durable.

## Configuration

Copy [.env.example](./.env.example) to `.env` for local development. Production deployments should provide the same values through the host platform or `deploy/.env`.

Required runtime variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `NEXTAUTH_SECRET` | Strong secret for Auth.js sessions/JWTs. Generate one with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Canonical app URL, for example `http://localhost:3000` or `https://example.com`. |
| `ADMIN_EMAILS` | Comma-separated allowlist for admin access. |

Authentication variables:

| Variable | Purpose |
| --- | --- |
| `GITHUB_ID`, `GITHUB_SECRET` | Enables GitHub OAuth when both are present. |
| `GOOGLE_ID`, `GOOGLE_SECRET` | Enables Google OAuth when both are present. |
| `AUTH_URL` | Optional canonical URL used by WebAuthn origin/RP detection. Falls back to `NEXTAUTH_URL` and Vercel URL values. |

Recommended security/privacy variables:

| Variable | Purpose |
| --- | --- |
| `ANALYTICS_IP_SALT` | Salt used to hash IPs before storing analytics events. If omitted, IP hashes are not recorded. |
| `NEXT_PUBLIC_SITE_URL` | Public site URL for metadata and canonical links where supported. |
| `NEXT_PUBLIC_SITE_NAME` | Optional public site name. |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | Optional public site description. |

Media storage variables:

| Storage | Variables |
| --- | --- |
| AWS S3 or compatible | `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, optional `S3_ENDPOINT`. |
| Cloudflare R2 | `R2_REGION`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`. |
| Local fallback | No storage variables required. Files are written under `public/uploads`. Use durable storage in production. |

Optional runtime tuning:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_RUM_SAMPLING_RATE` | Client-side Core Web Vitals sampling rate. Defaults to `0.1`. |
| `RUM_SAMPLING_RATE` | Server-side RUM ingestion sampling rate. Defaults to `0.1`. |
| `EXCERPT_MAX_CHARS` | Maximum generated excerpt length for imports. |
| `EXCERPT_ELLIPSIS` | Ellipsis text for generated excerpts. |
| `EXCERPT_INCLUDE_BLOCK_CODE` | Include code blocks when generating excerpts. |
| `NARRAVO_DISABLE_DB` | Test/tooling escape hatch that disables database initialization. |

## Database Management

Narravo uses Drizzle migrations in [drizzle/migrations](./drizzle/migrations) and the schema in [drizzle/schema.ts](./drizzle/schema.ts).

| Command | Purpose |
| --- | --- |
| `pnpm drizzle:generate` | Generate a migration from schema changes. |
| `pnpm drizzle:migrate` | Apply pending migrations. Used by CI and Docker entrypoint. |
| `pnpm drizzle:check` | Inspect migration tracking for the configured database. |
| `pnpm drizzle:sync` | Repair migration tracking after manual intervention. Requires `CONFIRM_MIGRATION_SYNC=yes`. |
| `pnpm drizzle:push` | Push schema directly. Use only for local development or disposable databases. |
| `pnpm seed:config` | Seed required configuration defaults. |
| `pnpm seed:posts` | Seed optional demo posts/comments. |

See [docs/DATABASE_MIGRATIONS.md](./docs/DATABASE_MIGRATIONS.md) for migration workflow details.

## Data Operations

Narravo includes CLI and admin UI workflows for backup/export, restore previews, and purge operations.

Backup/export:

- `pnpm backup` creates a ZIP with JSON exports for posts, users, comments, comment attachments, reactions, redirects, configuration, and a `manifest.json`.
- `--skip-media` omits the media manifest.
- Current backups record media references in the manifest; they do not embed full remote media payloads.

```bash
pnpm backup -- --output backups/blog-$(date +%F).zip --verbose
pnpm backup -- --skip-media --verbose
```

Restore:

- `pnpm restore -- <backup.zip>` reads a backup archive and can run dry-run previews.
- Current restore support focuses on posts, users, and configuration, with slug/date filters for posts.
- Use `--skip-users` and `--skip-config` when restoring content into an existing site.

```bash
pnpm restore -- backups/blog-2026-06-06.zip --dry-run
pnpm restore -- backups/blog-2026-06-06.zip --dry-run --slugs hello-world,second-post
pnpm restore -- backups/blog-2026-06-06.zip --start-date 2025-01-01 --skip-users --skip-config
```

Purge:

- Admin purge routes support dry runs and explicit confirmations for destructive operations.
- Hard delete workflows remove selected data and imported-media files where applicable.
- All admin data-operation endpoints require admin access with 2FA verification.

## WordPress WXR Import

The WXR importer supports both the Admin UI and CLI:

```bash
pnpm wxr:import -- path=./export.xml --dry-run --verbose
pnpm wxr:import -- path=./export.xml --skip-media
pnpm wxr:import -- path=./export.xml --purge allowedHosts=example.com,cdn.example.com concurrency=4
```

Offline media import example:

```bash
pnpm wxr:import -- path=./export.xml --purge uploads=/path/to/wp-backup/uploads root='^https?://old-site\.com$' --verbose
```

Supported options include:

- `path=<file>`: required WXR export path.
- `--dry-run`: parse and preview without writing.
- `--skip-media`: import content without fetching media.
- `--verbose`: enable detailed logs.
- `--rebuild-excerpts`: regenerate excerpts even when present.
- `--purge`: remove existing imported content/data before import. Use carefully.
- `uploads=<path>` and `root=<pattern>`: map remote WordPress upload URLs to a local uploads folder.
- `allowedHosts=<hosts>`: comma-separated host allowlist for media downloads.
- `concurrency=<number>`: media download concurrency from 1 to 10.

See [docs/wordpress-import.md](./docs/wordpress-import.md) for the full import guide.

## Upload Cleanup

Image/video uploads start as temporary rows and are committed when related content is saved. Run cleanup periodically to remove abandoned temporary files and database rows.

```bash
pnpm cleanup:uploads -- --dry-run
pnpm cleanup:uploads
pnpm cleanup:uploads -- --age-hours=48
```

Use a cron job or scheduled task for production sites with active editing.

## Development Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server. |
| `pnpm build` | Build the production app. |
| `pnpm start` | Start the production server from a built app. |
| `pnpm typecheck` | Generate `src/version.ts` and run `tsc --noEmit`. |
| `pnpm test` | Run the Vitest suite. |
| `pnpm test:watch` | Run Vitest in watch mode. |
| `pnpm wxr:import -- path=...` | Run the WordPress WXR importer. |
| `pnpm backup` | Create a backup ZIP. |
| `pnpm restore -- <file>` | Restore or preview a backup archive. |
| `pnpm cleanup:uploads` | Remove old temporary uploads. |
| `pnpm perf:lighthouse` | Run Lighthouse CI. |
| `pnpm perf:loadtest` | Run Autocannon smoke load testing. |
| `pnpm perf:benchmark` | Run the combined performance benchmark suite. |
| `pnpm perf:analyze` | Build with bundle analyzer enabled. |
| `pnpm perf:weekly` | Produce a weekly performance rollup report. |

## Project Structure

```text
src/app/                Next.js App Router routes and route handlers
  (admin)/admin/        Protected admin pages
  (auth)/login/         Login and 2FA login routes
  (public)/             Public post, archive, search, and static routes
  api/                  API routes for auth, admin, metrics, uploads, imports, 2FA
src/components/         Public, admin, auth, editor, and shared UI components
src/lib/                Domain services: auth, posts, comments, analytics, config, storage, 2FA
drizzle/                Schema snapshots and migrations
scripts/                Migrations, seeding, WXR import, backup, restore, maintenance
tests/                  Vitest unit and integration tests
docs/                   Additional design, import, upload, performance, and migration docs
deploy/                 Docker Compose, Caddy, nginx, and production deployment notes
```

## Deployment

Supported deployment paths:

- Docker Compose on a VM using [docker-compose.prod.yml](./docker-compose.prod.yml).
- Proxmox/LXC or a regular Linux VM running Node 22, pnpm, PostgreSQL, and a reverse proxy.
- Managed hosting such as Vercel with managed PostgreSQL such as Neon.

The production Docker image uses Node 22 and runs `pnpm drizzle:migrate` at container startup through [deploy/entrypoint.sh](./deploy/entrypoint.sh). If local media storage is used, mount persistent storage at `/app/public/uploads`.

See [deploy/README_DEPLOY.md](./deploy/README_DEPLOY.md) for deployment walkthroughs. Verify Node and pnpm versions there against this README if you adapt older manual commands.

## Analytics and Observability

- Page/post view events feed daily aggregate tables and the public trending widget.
- Bot filtering and optional salted IP hashing reduce stored personal data.
- Core Web Vitals are collected through `RUMCollector` and posted to `/api/rum`.
- The Next proxy and route helpers expose Server-Timing data for performance investigation.
- Performance scripts integrate Lighthouse CI, Autocannon, bundle analysis, and weekly reports.

See [docs/perf/README.md](./docs/perf/README.md) for performance tooling details.

## Security

- Admin access is restricted to `ADMIN_EMAILS`.
- Admin mutation routes and data-operation APIs require 2FA verification through `requireAdmin2FA`.
- TOTP, WebAuthn/passkeys, recovery codes, and trusted devices are supported.
- Content is sanitized with DOMPurify before storage/rendering.
- Uploads validate MIME type, byte limits, key safety, and file signatures where applicable.
- Presigned S3/R2 upload URLs require an authenticated session and enforce content length.
- CSP, HSTS, Referrer-Policy, and X-Content-Type-Options are set in Next configuration.
- Rate-limit and abuse helpers protect comments, reactions, imports, and 2FA flows.
- Analytics can hash IPs with `ANALYTICS_IP_SALT` and skips IP hashes when no salt is configured.

Dependency security status is best checked against the current lockfile:

```bash
pnpm audit
```

GitHub Dependabot alerts may lag until dependency changes are pushed and the dependency graph is refreshed.

## Testing and Quality

Typical local checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Integration tests and migration checks need `DATABASE_URL` to point at a reachable PostgreSQL database. CI starts PostgreSQL 16, runs migrations, typechecks, builds, and then runs the Vitest suite.

Useful database-backed check:

```bash
DATABASE_URL=postgres://narravo:changeme@localhost:5432/narravo pnpm drizzle:check
```

## License

Narravo is licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
