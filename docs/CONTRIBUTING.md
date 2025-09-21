<!-- SPDX-License-Identifier: Apache-2.0 -->
# Contributing to Narravo

Welcome! This document explains how to build, run, test, and contribute code to Narravo.
The project uses Next.js 14 with App Router, TypeScript, React, and PostgreSQL.

## Tech Stack Overview

```
/app/                             # Next.js App Router pages and layouts
  /(admin)/                       # Admin interface routes
  /(auth)/                        # Authentication routes  
  /(public)/                      # Public blog routes
  /api/                           # API routes
/components/                      # Reusable React components
/lib/                            # Utility functions and services
/drizzle/                        # Database schema and migrations
/tests/                          # Vitest + React Testing Library tests
/docs/                           # Documentation and guides
/scripts/                        # Build and utility scripts
```

## Development quickstart

### 0) Requirements
- Node.js 18+ and pnpm
- Docker and Docker Compose (for PostgreSQL)

### 1) Start PostgreSQL with Docker
```bash
docker compose up -d db
# Wait for container to be healthy
docker ps
```

### 2) Environment setup
```bash
cp .env.example .env
# Edit .env to set DATABASE_URL and auth keys
```

### 3) Install dependencies & setup database
```bash
pnpm install
pnpm drizzle:push      # Create tables
pnpm seed:config       # Seed configuration
pnpm seed:posts        # (Optional) Seed demo content
```

### 4) Run development server
```bash
pnpm dev
# Open http://localhost:3000
```

## Code style & quality

- **TypeScript**: Strict mode with `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **React**: Server Components by default; mark Client Components with `"use client"`
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Formatting**: ESLint + Prettier; run `pnpm lint` before committing
- **Database**: Use Drizzle ORM; no raw SQL; migrations for schema changes
- **Security**: Sanitize HTML with DOMPurify; validate inputs with Zod schemas

## Testing

- **Unit tests**: Utility functions, components, Server Actions
- **Integration**: Database operations, API routes, auth flows
- **Testing tools**: Vitest + React Testing Library + @testing-library/jest-dom

Run tests with:
```bash
pnpm test         # Run once
pnpm test:watch   # Watch mode
```

## Database changes

For schema modifications:
```bash
# 1. Edit drizzle/schema.ts
# 2. Generate migration
pnpm drizzle:generate
# 3. Apply to database
pnpm drizzle:push
```

## Commit & PR guidelines

- **Conventional Commits**:
  - `feat(admin): add post editor component`
  - `fix(auth): handle OAuth callback errors`
  - `docs: update setup instructions`
- **Small PRs** with focused scope
- Include screenshots/GIFs for UI changes
- Update docs for user-facing changes

## Verification commands

Before submitting PRs, ensure:
```bash
pnpm typecheck    # TypeScript compilation
pnpm test         # All tests pass
pnpm build        # Production build works
```

## Where to change what

- **New database entities**: `drizzle/schema.ts` + migration
- **Public pages**: `app/(public)/` routes
- **Admin interface**: `app/(admin)/` routes  
- **API endpoints**: `app/api/` routes
- **Shared components**: `components/` directory
- **Business logic**: `lib/` directory
- **Documentation**: `docs/` directory

---

Thanks for contributing! Open a discussion for large architectural changes to keep the roadmap aligned.
