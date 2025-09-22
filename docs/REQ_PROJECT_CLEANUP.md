# Request: Project Root Cleanup and Restructure

This document outlines the recommended cleanup for the busy project root and a practical, low-risk migration plan. It follows common patterns used by open-source Next.js (App Router) + TypeScript projects on GitHub.

For a deeper rationale and context, see docs/RESTRUCTURE.md.

## Objectives
- Reduce clutter in the repository root.
- Group application code under src/.
- Keep tooling discoverable and working (Next.js, Tailwind, Vitest, Drizzle).
- Avoid breaking changes by preserving the @/* alias.
- Update README to reflect both the current and target structures.

## Target Top-level Layout (post-cleanup)
```
/                      # Root
├─ src/                # All application code
│  ├─ app/             # Next.js App Router
│  ├─ components/      # Shared UI components
│  ├─ lib/             # Utilities, services
│  ├─ types/           # TypeScript types (consolidated)
│  ├─ hooks/           # (optional)
│  └─ features/        # (optional)
│
├─ public/             # Static assets (unchanged)
├─ drizzle/            # Drizzle schema + migrations (unchanged)
├─ scripts/            # One-off scripts (unchanged)
├─ tests/              # Tests (unchanged)
├─ docs/               # Documentation (unchanged)
├─ deploy/             # Deployment configs (unchanged)
│
├─ next.config.mjs     # Keep at root
├─ tailwind.config.cjs # Keep at root
├─ postcss.config.cjs  # Keep at root
├─ vite.config.ts      # Vitest config; alias -> ./src/
├─ tsconfig.json       # paths -> ./src/*
├─ Dockerfile          # Consider moving into deploy/ (optional)
├─ docker-compose*.yml # Consider moving into deploy/ (optional)
└─ package.json
```

## Step-by-step Plan (safe and incremental)

Use this checklist to implement the cleanup. You can complete it in one PR or multiple small PRs.

1) Prepare src/ and move application code
- [ ] Create src/
- [ ] Move app/ -> src/app/
- [ ] Move components/ -> src/components/
- [ ] Move lib/ -> src/lib/
- [ ] Merge types/ and src/types/ -> src/types/

2) Update path aliases to preserve imports
- [ ] tsconfig.json: set "paths": { "@/*": ["./src/*"] }
- [ ] vite.config.ts (Vitest): set alias '@' -> fileURLToPath(new URL('./src/', import.meta.url))
- [ ] Grep for non-aliased deep imports and fix if needed (e.g., ../../lib -> @/lib)

3) Verify Next.js and tooling still work
- [ ] pnpm install
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm dev (confirm the app runs at http://localhost:3000)

4) README and docs
- [ ] Update README.md to explain the cleanup and point to this doc
- [ ] Update README’s Project Structure section to show both current and target structure (until migration is complete)
- [ ] Keep docs/RESTRUCTURE.md as the detailed rationale and mapping reference

5) Optional: move container/deploy files
- [ ] Move Dockerfile -> deploy/Dockerfile and update docs/scripts references
- [ ] Move docker-compose*.yml -> deploy/ and update docs/scripts references
- [ ] If you move them, update README sections that reference these files

6) Housekeeping
- [ ] Ensure ESLint/Prettier (if present) include src/** paths
- [ ] Ensure any custom scripts (scripts/*.ts) referencing paths are updated
- [ ] Search for absolute file paths or hard-coded locations and update

## tsconfig.json example (paths)
```jsonc
{
  "compilerOptions": {
    // ...existing options
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## vite.config.ts example (alias)
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
})
```

## Validation
- Run typechecks and tests: pnpm typecheck && pnpm test
- Run the app: pnpm dev and navigate through key pages
- Smoke test critical flows (auth, DB access, public page rendering)

## Rollback Plan
Because the change is mostly file moves and alias tweaks, rollback is straightforward:
- Revert tsconfig.json and vite.config.ts changes
- Move src/app, src/components, src/lib back to root
- Restore types/ if you consolidated it into src/types/

---

Maintainer note: This plan intentionally avoids CI/CD changes. It is self-contained to this repository and mirrors patterns seen in widely adopted open-source Next.js projects.