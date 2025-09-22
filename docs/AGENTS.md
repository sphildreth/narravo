<!-- SPDX-License-Identifier: Apache-2.0 -->
# AGENTS.md — Automation & Coding Agents Guide

This guide outlines **what tasks are safe to automate**, constraints to follow, and the acceptance criteria agents must meet for the Next.js/TypeScript version of Narravo.

## Scope of agent work (safe to automate)

- **React Components** for admin and public interfaces (Next.js App Router + Tailwind CSS)
- **Server Actions** for form handling and data mutations  
- **API Routes** for external integrations and webhooks
- **Drizzle Schema** migrations *that don't drop data* and add proper indexes
- **Next.js Caching** strategies and revalidation patterns
- **Import pipeline** expansions (WXR field mapping) with TypeScript types
- **Backup/Restore** enhancements (manifest, selective restore)
- **SEO**: RSS/sitemap generators, Open Graph/meta tags
- **Docs**: feature guides, troubleshooting, getting-started

> Avoid large architectural changes or database-specific SQL unless the task explicitly calls for it.

## Guardrails & constraints

- **Idempotency**: migrations and batch jobs must be safe to run twice.
- **No secrets**: use placeholders for OAuth, connection strings, API keys.
- **PostgreSQL-first**: keep code compatible with PostgreSQL; use Drizzle ORM abstractions.
- **Sanitization**: never render or store user HTML without server-side sanitizing via DOMPurify.
- **Accessibility**: UI changes must preserve keyboard/focus and WCAG 2.1 AA guidelines.
- **Performance**: use Next.js caching appropriately; minimize client-side JavaScript.
- **Type Safety**: maintain strict TypeScript configuration with proper null checks.

## Definition of done (per task)

- Code compiles (`pnpm typecheck`) and passes linters/formatters.
- Tests added/updated: unit + integration if behavior changes.
- Docs updated if user-visible change (README or a doc under `/docs`).
- Screenshots/gifs for UI changes in the PR description.
- No secrets in code or history.

## Project structure expectations

Use these current paths:

```
/app                    # Next.js App Router pages and layouts
  /(admin)             # Admin interface routes
  /(auth)              # Authentication routes  
  /(public)            # Public blog routes
  /api                 # API routes
/components            # Reusable React components
/lib                   # Utility functions and services
/drizzle              # Database schema and migrations
/tests                # Test files
/docs                 # Documentation
/scripts              # Build and utility scripts
```

## Task templates (copy into GitHub issues)

### 1) Feature slice
**Summary**: <what the user needs>  
**Spec refs**: README sections + acceptance criteria  
**Deliverables**:
- [ ] Implement <feature> with TypeScript types
- [ ] Unit tests for <cases>
- [ ] Update docs at `/docs/<feature>.md`
- [ ] Screenshots/gif of UI
**Acceptance**:
- [ ] All AC pass
- [ ] `pnpm typecheck && pnpm test` green

### 2) Database schema change
**Summary**: Add/modify schema for <entity>  
**Deliverables**:
- [ ] Drizzle migration created and reviewed
- [ ] Indexes/uniques defined
- [ ] TypeScript types updated
- [ ] Backfill script or data-safe defaulting
**Acceptance**:
- [ ] Can run migration on a copy of sample DB without data loss
- [ ] Queries show expected plan (indexes used)

### 3) React component
**Summary**: Create/modify <component> for <use case>
**Deliverables**:
- [ ] TypeScript component with proper props interface
- [ ] Responsive design with Tailwind CSS
- [ ] Accessibility features (ARIA, keyboard navigation)
- [ ] Unit tests with React Testing Library
**Acceptance**:
- [ ] Component renders correctly in all states
- [ ] Meets WCAG 2.1 AA standards
- [ ] Mobile responsive

## Verification commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

For database changes:
```bash
pnpm drizzle:push     # Push schema changes
pnpm seed:config      # Seed configuration if needed
```

## PR hygiene

- Conventional commit in title.
- Keep PRs < 400 lines if possible; split otherwise.
- Include before/after screenshots for UI.

---

Agents should comment the exact files they modified and why, and link lines in PRs that implement each acceptance criterion.
