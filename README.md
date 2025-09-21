<!-- SPDX-License-Identifier: Apache-2.0 -->
# Narravo

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

A modern, minimal blog engine built with Next.js 14 App Router, TypeScript, Drizzle ORM (Postgres), Auth.js (GitHub/Google), nested comments with moderation, reactions, and optional S3/R2 media uploads.

- Next.js 14 (App Router, Server Actions, RSC by default)
- TypeScript (strict), Tailwind CSS
- PostgreSQL + Drizzle ORM
- Auth.js (NextAuth) with GitHub/Google OAuth
- Nested comments, attachments (image/video), reactions
- Config service backed by database
- Vitest + Testing Library
- Docker Compose for local Postgres

## Table of contents
- Features
- Tech stack
- Project structure
- Quick start
- Environment variables
- Database (migrations, seeding)
- Development scripts
- Docs and APIs
- Testing
- Troubleshooting
- Contributing
- License

## Features
- Posts: typed data model and basic public pages
- Authentication: GitHub/Google via Auth.js, JWT sessions
- Admin: moderation queue with approve/spam/delete, edit comments, remove attachments
- Comments: nested threads (with path-based tree), pagination for top level and replies
- Reactions: emoji-like reactions with per-user uniqueness
- Media uploads: presigned S3-compatible uploads (AWS S3 or Cloudflare R2)
- Configuration: feature and UX settings stored centrally in DB with per-user overrides ready (MVP uses global)
- Performance: ISR and caching with revalidateTag/revalidatePath where appropriate

## Tech stack
- Frontend: Next.js 14 (App Router), React 18, TypeScript
- Styling: Tailwind CSS
- Database: PostgreSQL + Drizzle ORM
- Auth: Auth.js (NextAuth) providers (GitHub, Google)
- Tests: Vitest + Testing Library
- Package manager: pnpm
- Dev infra: Docker Compose (Postgres)

## Project structure
```
app/                    # Next.js App Router routes
├── (admin)/            # Admin routes group
├── (auth)/             # Auth routes group
├── (public)/           # Public routes group
├── api/                # API endpoints
components/             # Reusable components
lib/                    # Server-side services and utilities
drizzle/                # DB schema and migrations
scripts/                # Seed/import scripts
tests/                  # Unit tests
docs/                   # Design + API docs
```

## Quick start
These steps assume Docker, Node 18+, and pnpm.

```bash
# 0) Start Postgres (Docker)
docker compose up -d db

# 1) Install deps
pnpm install

# 2) Configure env
cp .env.example .env
# Ensure DATABASE_URL and NEXTAUTH_SECRET are set. For local Docker, .env.example defaults work.

# 3) Apply schema (create tables)
pnpm drizzle:push

# 4) Seed required configuration defaults (caching, pagination, etc.)
pnpm seed:config

# 5) (Optional) Seed demo posts/comments
pnpm seed:posts

# 6) Run dev server
pnpm dev
# open http://localhost:3000
```

If you prefer a manual DB, set `DATABASE_URL` accordingly and skip Docker.

## Environment variables
All variables are documented in `.env.example`. Copy it and adjust for your environment:

```bash
cp .env.example .env
```

Required (local dev):
- DATABASE_URL: Postgres connection string (Docker defaults provided)
- NEXTAUTH_SECRET: strong random string for session/JWT encryption
- NEXTAUTH_URL: your app URL (defaults to http://localhost:3000 for dev)
- ADMIN_EMAILS: comma-separated allowlist for admin capabilities

OAuth (optional; enabled when both ID and SECRET are provided):
- GitHub: GITHUB_ID, GITHUB_SECRET
- Google: GOOGLE_ID, GOOGLE_SECRET

Media storage (optional; enable either S3_* or R2_* set):
- S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT?
- or R2_REGION, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT?

See `lib/s3.ts` for how these are detected at runtime.

## Database (migrations, seeding)
- Generate migrations from schema changes:
  ```bash
  pnpm drizzle:generate
  ```
- Push schema to database:
  ```bash
  pnpm drizzle:push
  ```
- Seed configuration (required for first run):
  ```bash
  pnpm seed:config
  ```
- Seed demo content:
  ```bash
  pnpm seed:posts
  ```

The seed config includes keys like:
- SYSTEM.CACHE.DEFAULT-TTL
- PUBLIC.HOME.REVALIDATE-SECONDS
- COMMENTS.MAX-DEPTH, COMMENTS.TOP-PAGE-SIZE, COMMENTS.REPLIES-PAGE-SIZE
- RATE.* (basic rate limits)
- UPLOADS.* (size and MIME allowlists)
- FEED.LATEST-COUNT, ARCHIVE.MONTHS-SIDEBAR
- MODERATION.PAGE-SIZE
- APPEARANCE.BANNER.* (banner defaults)

## Development scripts
```bash
pnpm dev            # start Next.js dev server
pnpm build          # production build
pnpm start          # start production server
pnpm typecheck      # TypeScript type check
pnpm test           # run tests (Vitest)
pnpm test:watch     # watch mode for tests
pnpm drizzle:generate  # create migration from schema diffs
pnpm drizzle:push      # apply schema to DB
pnpm seed:config       # seed configuration defaults
pnpm seed:posts        # seed demo posts/comments
pnpm wxr:import path=./sample.wxr  # import WordPress WXR (stub)
```

## Docs and APIs
- Admin API overview: `docs/ADMIN_API.md`
- Moderation notes: `docs/moderation.md`
- Reactions: `docs/reactions.md`
- Media uploads: `docs/media-uploads.md`
- Importer: `scripts/import-wxr.ts`
- Project slices: `docs/PRD_SPEC.md`, `docs/PRD_SPEC_IMPLEMENTATION_SLICES.md`

## Testing
We use Vitest with Testing Library. Run the full suite:
```bash
pnpm test
```
Type-only checks:
```bash
pnpm typecheck
```

## Troubleshooting
- Home page 404/500 on first run
  - The home page reads required config keys: `PUBLIC.HOME.REVALIDATE-SECONDS` and `FEED.LATEST-COUNT`.
  - If these are missing or the DB isn’t reachable, the page will error during SSR.
  - Fix by applying the schema and seeding config while Postgres is running:
    ```bash
    docker compose up -d db
    pnpm drizzle:push
    pnpm seed:config
    ```
- Admin endpoints
  - Admin routes require your email in `ADMIN_EMAILS` in `.env`.
  - Sign in via Auth.js provider and verify access before calling admin APIs.
- Postgres port in use (5432)
  - Change the `ports:` mapping in `docker-compose.yml` (e.g., `55432:5432`) and update `DATABASE_URL`.
- Drizzle push fails
  - Check `DATABASE_URL` and container status: `docker compose ps`.
- OAuth callback mismatch
  - When ports/hosts change, update `NEXTAUTH_URL` and OAuth app callback URLs accordingly.

### Docker-based DB onboarding
```bash
# Start Postgres
docker compose up -d db
# Verify container
docker compose ps
# Tables overview (optional)
docker compose exec db psql -U narravo -d narravo -c "\dt"
# Stop / remove / reset
# stop only
docker compose stop db
# remove container, keep data
docker compose rm -f db
# nuke data volume (fresh start)
docker compose down -v
```

## Contributing
Contributions welcome! A few guidelines:
- Use pnpm
- Follow Conventional Commits:
  - `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- Keep PRs focused and include tests when changing behavior
- Align with project patterns (App Router, Server Actions, Drizzle, Zod validation where applicable)
- Add or update docs in `docs/` and README when needed
- See also: `docs/CONTRIBUTING.md` for more details

## License
Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
