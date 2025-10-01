<!-- SPDX-License-Identifier: Apache-2.0 -->
![Narravo Logo](./public/images/logo-60x57.png) Narravo: A Modern Next.js Blog Engine

[![CI](https://github.com/sphildreth/narravo/actions/workflows/ci.yml/badge.svg)](https://github.com/sphildreth/narravo/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-blue?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-blue?logo=drizzle&logoColor=white)](https://orm.drizzle.team/)
[![Auth.js](https://img.shields.io/badge/Auth.js-blue?logo=next.js&logoColor=white)](https://authjs.dev/)

Narravo is a sleek, minimal, and feature-rich blog engine designed for developers who appreciate modern web technologies and a robust content management experience. Built with the latest Next.js App Router, TypeScript, and Drizzle ORM, it offers a powerful foundation for your next personal blog or content platform.

✨ **Key Features:**

*   **Next.js 15 App Router:** Server Components, Server Actions, ISR, and smart caching tuned for fast content delivery.
*   **React 19 + TypeScript 5.9:** Strict typing, modern React patterns, and explicit null handling across the stack.
*   **Tailwind CSS Design System:** Utility-first styling with theme tokens, dark mode, and Radix-powered primitives.
*   **PostgreSQL + Drizzle ORM:** Type-safe queries, migrations, and transactions with first-class PostgreSQL support.
*   **Auth.js (NextAuth):** GitHub/Google OAuth, admin allowlists, and session management ready to go.
*   **Config Service & Feature Flags:** Database-backed settings power runtime toggles (themes, rate limits, UI modules).
*   **WordPress WXR Import:** Resume-safe imports covering posts, media, redirects, excerpts, and CLI/admin workflows.
*   **Data Operations Toolkit:** One-command backup/export, selective restore, purging, and manifest verification with audit logs.
*   **Comments, Media & Reactions:** Threaded discussions, image/video uploads, emoji reactions, honeypot/rate-limited submissions.
*   **Admin Control Center:** Moderation queue, system settings, analytics dashboards, and import/backups in one place.
*   **S3/R2 Media Storage:** Presigned uploads with validation for AWS S3 or Cloudflare R2 plus local fallbacks.
*   **Analytics & Observability:** Privacy-aware trending metrics, Core Web Vitals RUM pipeline, Server-Timing headers, and perf scripts.
*   **Security Hardening:** CSP, HSTS, DOMPurify sanitization, hashed IP analytics, rate limits, and audit-friendly logging.
*   **Dockerized Development & Testing:** Docker Compose Postgres, Vitest test suites, and perf/load tooling baked in.

---

## 👀 DEMO SITE: (My personal blog) [Knowledge Tome](https://www.shildreth.com)

---

## 🚀 Quick Start

Get Narravo up and running in minutes!

**Prerequisites:**
*   [Docker](https://www.docker.com/get-started)
*   [Node.js](https://nodejs.org/en/download/) (v18+)
*   [pnpm](https://pnpm.io/installation)

```bash
# 0) Start PostgreSQL database with Docker Compose
docker compose up -d db

# 1) Install project dependencies
pnpm install

# 2) Configure environment variables
cp .env.example .env
# IMPORTANT: Ensure DATABASE_URL, NEXTAUTH_SECRET, ADMIN_EMAILS, and ANALYTICS_IP_SALT are set.
# Adjust NEXTAUTH_URL and OAuth provider IDs as needed for your environment.

# 3) Run database migrations (create tables)
pnpm drizzle:migrate

# 4) Seed essential configuration defaults
pnpm seed:config

# 5) (Optional) Seed demo posts and comments
pnpm seed:posts

# 6) Start the development server
pnpm dev
# Open your browser to http://localhost:3000
```

> 💡 **Manual DB Setup:** If you prefer a manual PostgreSQL instance, update `DATABASE_URL` in your `.env` file and skip the `docker compose up -d db` step.

---

## 🚢 Deployment

Narravo is designed for flexible deployment. You can host it on your own infrastructure using Docker or deploy it to a serverless platform like Vercel.

*   **Option A: Docker Compose** - A single VM setup using Docker Compose to run the application and database. This is a good option for self-hosting.
*   **Option B: Vercel + Neon** - A serverless setup using Vercel for the application and Neon for the database. This is a good option for a managed, scalable solution.

For detailed deployment instructions, please refer to the [**Production Deployment Guide**](./deploy/README_DEPLOY.md).

---

## 🧱 Architecture Overview

- **App Router Layout:** The `src/app` tree separates public routes (`(public)`), authentication (`(auth)`), and admin tooling (`(admin)`), leaning on React Server Components by default. Middleware injects route context and handles legacy redirect resolution at the edge.
- **Domain Modules:** Business logic lives in `src/lib` with clear boundaries for posts, comments, reactions, imports, backups, rate limiting, analytics, and configuration. Server Actions validate input with Zod and revalidate cache tags after mutations.
- **Data & Configuration:** Drizzle ORM drives the schema (`drizzle/schema.ts`) with migrations and transactions. A Config Service exposes database-backed feature flags (banner, theming, rate limits, render badges, etc.) to both server and client code.
- **Engagement Pipeline:** Comments support nested threads, media attachments, moderation queues, and reaction toggles. Rate limiting, honeypots, media validation, and audit logging protect the workflow.
- **Content Migration:** The WordPress importer coordinates resumable jobs, media rewriting, redirect creation, and excerpt rebuilding from either the Admin UI or CLI scripts.
- **Observability:** Privacy-aware analytics aggregate daily view counts, power trending widgets, and surface dashboards. Real User Monitoring collects Core Web Vitals, while Server-Timing instrumentation and perf scripts keep regressions in check.

---

## ⚙️ Configuration

All environment variables are documented in detail within the `.env.example` file. Copy it to `.env` and adjust as needed:

```bash
cp .env.example .env
```

**Key Variables:**

*   `DATABASE_URL`: PostgreSQL connection string.
*   `NEXTAUTH_SECRET`: A strong, random string for session/JWT encryption.
*   `NEXTAUTH_URL`: Your application's URL (e.g., `http://localhost:3000`).
*   `ADMIN_EMAILS`: Comma-separated list of emails for admin access.

**Optional Integrations:**

*   **OAuth:** `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_ID`, `GOOGLE_SECRET`
*   **Media Storage:** Configure either `S3_*` (AWS S3) or `R2_*` (Cloudflare R2) variables.
*   **Analytics & Perf:**
    * `ANALYTICS_IP_SALT` — salt used to hash IP addresses before persisting view events.
    * `NEXT_PUBLIC_RUM_SAMPLING_RATE` / `RUM_SAMPLING_RATE` — client/server sampling (defaults to `0.1`).
    * `PERF_LOG_SLOW_QUERIES` — enable verbose query timing in development/CI.

---

## 🗄️ Database Management

Narravo uses Drizzle ORM for type-safe database interactions and migrations.

*   **Generate Migrations:** Create new migration files based on schema changes.
    ```bash
    pnpm drizzle:generate
    ```
*   **Apply Migrations:** Run pending migrations (production-safe).
    ```bash
    pnpm drizzle:migrate
    ```
*   **Check Migration Status:** Verify which migrations have been applied.
    ```bash
    pnpm drizzle:check
    ```
*   **Sync Migration Tracking:** Fix migration tracking after using `drizzle:push`.
    ```bash
    CONFIRM_MIGRATION_SYNC=yes pnpm drizzle:sync
    ```
*   **Push Schema (Dev Only):** Quickly sync schema during local development.
    ```bash
    pnpm drizzle:push
    ```
*   **Seed Configuration:** Essential for initial setup and default settings.
    ```bash
    pnpm seed:config
    ```
*   **Seed Demo Content:** Populate your blog with sample posts and comments.
    ```bash
    pnpm seed:posts
    ```

> 📖 **For detailed migration workflows and troubleshooting**, see the [Database Migration Guide](./docs/DATABASE_MIGRATIONS.md).

---
## 🗄️ Database Management

Navravo uses Drizzle ORM for type-safe database interactions and migrations.

*   **Run Migrations:** Apply pending migrations to your database (production-safe).
    ```bash
    pnpm drizzle:migrate
    ```
*   **Generate Migrations:** Create new migration files based on schema changes.
    ```bash
    pnpm drizzle:generate
    ```
*   **Push Schema (Dev Only):** Quickly sync schema during local development.
    ```bash
    pnpm drizzle:push
    ```
*   **Seed Configuration:** Essential for initial setup and default settings.
    ```bash
    pnpm seed:config
    ```
*   **Seed Demo Content:** Populate your blog with sample posts and comments.
    ```bash
    pnpm seed:posts
    ```https://github.com/sphildreth/narravo/actions/workflows/ci.yml/badge.svg)](https://github.com/sphildreth/narravo/actions/workflows/ci.yml)

---

## � Backups & Restore

Narravo ships with first-class data lifecycle tooling powered by Drizzle and S3-compatible manifests.

- **Full Backups:** `pnpm backup` creates a ZIP archive with JSON table exports, manifest hashes, and (optionally) media references.
- **Selective Restore:** `pnpm restore -- <backup.zip> [--slugs slug-a,slug-b] [--start-date YYYY-MM-DD]` supports dry runs, slug/date filters, and skipping users/configuration.
- **Media Awareness:** Manifests capture attachment URLs and hashes so you can verify remote assets before rehydration.
- **Audit Friendly:** Both commands log counts, checksum data, and skip reasons to aid compliance reviews.

```bash
# Create a verbose backup without media payloads
pnpm backup -- --skip-media --verbose

# Preview restore scope for specific slugs before applying changes
pnpm restore -- backups/blog-2025-09-01.zip --dry-run --slugs my-first-post,second-post
```

---

## �🛠️ Development Scripts

A quick reference for common development tasks:

| Command                      | Description                                           |
| :--------------------------- | :---------------------------------------------------- |
| `pnpm dev`                   | Start the Next.js development server                  |
| `pnpm build`                 | Create a production-ready build                       |
| `pnpm start`                 | Start the production server                           |
| `pnpm typecheck`             | Run TypeScript type checks                            |
| `pnpm test`                  | Execute the full test suite (Vitest)                  |
| `pnpm test:watch`            | Run tests in watch mode                               |
| `pnpm drizzle:generate`      | Generate new Drizzle migrations                       |
| `pnpm drizzle:migrate`       | Apply pending migrations (production-safe)            |
| `pnpm drizzle:push`          | Sync schema directly (development only)               |
| `pnpm drizzle:check`         | Check migration status and database state             |
| `pnpm drizzle:sync`          | Fix migration tracking (after push)                   |
| `pnpm seed:config`           | Seed default configuration values                     |
| `pnpm seed:posts`            | Seed demo posts and comments                          |
| `pnpm wxr:import -- path=…`  | Launch the WordPress importer via CLI (supports flags) |
| `pnpm backup`                | Create a manifested ZIP backup (see Backups section)   |
| `pnpm restore -- <file>`     | Restore or dry run a backup archive                    |
| `pnpm perf:benchmark`        | Run the combined performance benchmark suite           |
| `pnpm perf:lighthouse`       | Execute Lighthouse CI checks                          |
| `pnpm perf:loadtest`         | Run Autocannon smoke load testing                      |
| `pnpm perf:analyze`          | Build with bundle analyzer enabled                     |
| `pnpm perf:weekly`           | Produce a weekly performance rollup report             |

---

## 📂 Project Structure

A high-level overview of the project's directory layout:

```
src/app/                # Next.js App Router routes (admin, auth, public, api)
src/components/         # Reusable UI components
src/lib/                # Server-side services, utilities, and business logic
src/types/              # TypeScript types (consolidated)
drizzle/                # Drizzle ORM schema and database migrations
scripts/                # Utility scripts (seeding)
tests/                  # Unit and integration tests
docs/                   # Project documentation and specifications
```

---

## 🔄 WordPress WXR Import

Narravo includes a powerful and resilient WordPress import tool to migrate your content from a WordPress WXR export file.

**Import Capabilities:**

*   **Comprehensive Content:** Imports posts, comments (with threading), categories, and tags.
*   **Flexible Statuses:** Choose which post statuses to import (e.g., `publish`, `draft`).
*   **Media & SEO:** Downloads media to S3/R2, rewrites content URLs, and creates 301 redirects from old WordPress post URLs.
*   **Offline Import Support:** Import media from local uploads directory when original site is offline or unreachable.
*   **Enhanced Purge:** Complete data reset option that removes all posts, comments, categories, tags, redirects, and uploaded files.
*   **Resilient Process:** Features include dry-runs, real-time progress, job cancellation, and detailed error logging.
*   **Admin UI & CLI:** Manage imports through the Admin Dashboard or automate them with a CLI script.

For a complete guide, see the [**WordPress Import Documentation**](./docs/wordpress-import.md).

### CLI Options

The `wxr:import` script supports several command-line flags to customize the import process:

*   `path=<file>`: (Required) The path to your WXR export file.
*   `--verbose`: Enables detailed logging for troubleshooting.
*   `--dry-run`: Simulates the import without making any changes to the database.
*   `--skip-media`: Skips downloading and processing of any media files.
*   `--rebuild-excerpts`: Forces regeneration of excerpts for all posts, even if they already have one.
*   `--purge`: **Deletes all existing posts, comments, tags, categories, redirects, and uploaded files** before starting the import. Use with caution.
*   `uploads=<path>`: Specifies the path to a local folder containing your WordPress `uploads` directory. Use this for offline imports where the original site is not reachable.
*   `root=<pattern>`: A regular expression to match the root URL of your old site (e.g., `^https?://my-old-site.com`). Required when using `uploads`.
*   `allowedHosts=<hosts>`: Comma-separated list of allowed domains for media downloads (e.g., `example.com,cdn.example.com`).
*   `concurrency=<number>`: Number of simultaneous media downloads (1-10, default: 4).

#### Example Offline Import

This command runs an import using a local backup of media files, purging all existing data and files first.

```bash
pnpm wxr:import -- path=./export.xml --purge uploads=/path/to/wp-backup/uploads root='^https?://my-old-site\.com$' --verbose
```

---

## 📊 Analytics & Observability

- **Trending & Dashboards:** View aggregation tables power the public "Trending Posts" widget and the `/admin/analytics` dashboard with sparklines, totals, and configurable date windows.
- **Privacy-Aware Metrics:** View events dedupe by session/IP, respect bot filters, and hash IP addresses when `ANALYTICS_IP_SALT` is set.
- **Real User Monitoring:** Drop `<RUMCollector />` into layouts to post Core Web Vitals to `/api/rum`. Control sampling with `NEXT_PUBLIC_RUM_SAMPLING_RATE` (client) and `RUM_SAMPLING_RATE` (server), both defaulting to 10%.
- **Performance Instrumentation:** Middleware adds Server-Timing headers, and the config flag `VIEW.PUBLIC-SHOW-RENDER-BADGE` surfaces render times in the UI. Perf scripts (`perf:*`) automate Lighthouse, bundle analysis, and load testing—see [`docs/perf/README.md`](./docs/perf/README.md).
- **Weekly Rollups & Benchmarks:** Use `pnpm perf:benchmark` or `pnpm perf:weekly` to archive reports in `docs/perf/` and catch regressions early.

---

## 🧑 About Me Sidebar

An optional About Me section can appear in the public sidebar.

- Enable/disable: SITE.ABOUT-ME.ENABLED (boolean)
- Title: SITE.ABOUT-ME.TITLE (string)
- Content: SITE.ABOUT-ME.CONTENT (string)

You can manage these in the Admin Dashboard:

- Navigate to Admin -> System -> About Me
- Toggle enable, edit the title and content, then Save Changes

When enabled, the About Me section renders above the Recent posts list.

---

## 🔐 Security

- **Sanitized Content:** All HTML passes through DOMPurify allowlists before storage/rendering, and markdown editors sanitize on save.
- **Strict Headers:** CSP, HSTS, Referrer-Policy, and X-Content-Type-Options are enabled via Next config and middleware defaults.
- **Rate Limiting & Abuse Controls:** Shared helpers cap comment/reaction/import rates, enforce submission delays, and add honeypots.
- **Safe Media Handling:** Attachments validate MIME types, file signatures, byte limits, and generate poster images for videos.
- **Privacy Respecting Analytics:** View tracking dedupes sessions, hashes IPs with `ANALYTICS_IP_SALT`, and honors DNT where possible.

---

## 🧪 Testing

We use [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/) for our test suite.

*   **Run all tests:**
    ```bash
    pnpm test
    ```
*   **Type checking only:**
    ```bash
    pnpm typecheck
    ```

---

## 📄 License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](./LICENSE) and [NOTICE](./NOTICE) files for more details.

