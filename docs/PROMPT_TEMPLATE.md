Project: Narravo (Next.js 14 + TypeScript + PostgreSQL + Drizzle ORM)
Goal: Implement <feature> per requirements & acceptance criteria.

Context
- Tech stack: Next.js 14 App Router, TypeScript, React 18, PostgreSQL, Drizzle ORM, Auth.js
- Repo layout:
  /app (Next.js routes), /components (React components), /lib (utilities), /drizzle (schema/migrations)
  /docs (guides), /tests (Vitest + React Testing Library), /scripts (build/seed tools)
- DB: PostgreSQL with Drizzle ORM, strict TypeScript types, migrations in /drizzle
- Security: server-side HTML sanitization (DOMPurify); rate limits on write endpoints
- Caching: Next.js built-in caching with revalidatePath/revalidateTag
- Style: strict TypeScript, Tailwind CSS, Conventional Commits

Scope (Do exactly this; nothing more)
1) <bullet list of concrete changes with exact file paths, components, and types to implement>
2) …
3) …

Acceptance Criteria (must all pass)
- <AC #1>
- <AC #2>
- <AC #3>
...

Deliverables
- Code changes in appropriate files with TypeScript types
- Docs updated in /docs/<topic>.md if user-facing
- Screenshots/GIFs for any UI changes
- Database migration (if schema changed) with proper indexes
- Tests for new functionality

Constraints
- Keep write operations efficient; use Server Actions for mutations
- No database-specific SQL; use Drizzle ORM abstractions
- Sanitize all user HTML on save and render with DOMPurify
- Respect TypeScript strict mode settings
- No secrets committed; use environment variables

Files to modify / create (proposed)
- <path/to/file1> (new or edit)
- <path/to/file2>
- …

Commands to run (verification)
```bash
    pnpm install
    pnpm typecheck
    pnpm test
    pnpm build
    # If schema changed:
    pnpm drizzle:push
```