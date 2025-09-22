# Repository Restructure Proposal

This document proposes a leaner, more conventional layout for a Next.js 14 (App Router) + TypeScript monorepo-style project, aligning with common open-source practices. It keeps the root clean, adopts a `src/`-rooted application layout, and preserves existing tooling (pnpm, Vitest, Drizzle ORM, Tailwind, Next.js).

## Goals

- Reduce root-level clutter while keeping DX simple
- Group all application code under `src/`
- Keep infra and assets discoverable (`public/`, `drizzle/`, `scripts/`, `docs/`)
- Preserve short imports with the `@` alias
- Avoid risky changes: no build tool swaps or CI required

## Proposed Top-Level Layout

```
/                      # Root kept minimal
├─ src/                # All application code
│  ├─ app/             # Next.js App Router (moved from /app)
│  ├─ components/      # Shared React components (moved from /components)
│  ├─ lib/             # Server/client utilities, services (moved from /lib)
│  ├─ types/           # Consolidated TypeScript types (from /types and /src/types)
│  ├─ hooks/           # React hooks (new, optional; can migrate over time)
│  ├─ styles/          # Optional: global styles, if you want to separate from app/
│  └─ features/        # Optional: feature-first modules (posts, comments, auth, ...)
│
├─ public/             # Static assets (unchanged)
├─ drizzle/            # Drizzle schema + migrations (unchanged; CLI expects it)
├─ scripts/            # One-off Node/TS scripts (unchanged)
├─ tests/              # Vitest tests (keep as-is for now)
├─ docs/               # Documentation (unchanged)
├─ deploy/             # Runtime deploy configs (unchanged)
│
├─ next.config.mjs     # Keep at root per Next.js conventions
├─ tailwind.config.cjs # Keep at root for tooling autodiscovery
├─ postcss.config.cjs  # Keep at root
├─ vite.config.ts      # Vitest config (alias updated to point to src/)
├─ tsconfig.json       # Update `paths` alias to `./src/*`
├─ docker-compose*.yml # Keep or move into deploy/ (see notes)
├─ Dockerfile          # Keep or move into deploy/ (see notes)
└─ package.json        # Root project manifest
```

Notes:
- Next.js supports the optional `src/` directory out of the box. Moving `app/` under `src/` is fully supported.
- Drizzle is commonly kept at the root (`drizzle/`) for CLI paths; leave it unless you want to rewrite `drizzle.config.ts` and related scripts.
- You have both `src/types/` and `types/`; consolidate into `src/types/`.

## Current vs Proposed Mapping

- `app/` → `src/app/`
- `components/` → `src/components/`
- `lib/` → `src/lib/`
- `types/` and `src/types/` → `src/types/` (merge)
- `app/globals.css` → `src/app/globals.css` (keeps relative imports working)
- `public/`, `drizzle/`, `scripts/`, `docs/`, `deploy/` → unchanged
- `tests/` → unchanged (you can later adopt co-located tests if you prefer)

Optional (nice-to-have, not required):
- Move `Dockerfile` and `docker-compose*.yml` into `deploy/` for a cleaner root. If you do, update your docs and any dev scripts accordingly.

## Config Changes (required)

Your current alias setup:
- `tsconfig.json` sets `"baseUrl": "."` and `"paths": { "@/*": ["./*"] }`.
- `vite.config.ts` (Vitest) sets `alias: { '@': fileURLToPath(new URL('./', import.meta.url)) }`.

After moving application code under `src/`, update both to point `@` at `src/`:

- tsconfig.json
```jsonc
{
  "compilerOptions": {
    // ...existing options...
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- vite.config.ts
```ts
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
```

These changes preserve existing imports like `import { db } from "@/lib/db";` without touching source files.

## Migration Plan (safe and incremental)

1) Create `src/` and move app code

```fish
mkdir -p src
and git mv app src/app
and git mv components src/components
and git mv lib src/lib
```

2) Consolidate types

```fish
mkdir -p src/types
# Move files from root types/ into src/types/ (if both exist)
if test -d types
  for f in (fd . types -t f)
    set rel (string replace -r '^types/' '' $f)
    mkdir -p (path dirname src/types/$rel)
    git mv $f src/types/$rel
  end
  git rm -r types
end
# If you already had src/types/, ensure no duplicates remain
```

3) Update aliases in config files

```fish
# tsconfig: change "./*" to "./src/*" for the @ path
sd '"@/\*": \["\.\/\*"\]' '"@/*": ["./src/*"]' tsconfig.json

# vitest alias: point to ./src/
sd "new URL\('\./', import.meta.url\)" "new URL('./src/', import.meta.url)" vite.config.ts
```

4) Sanity-check imports that don’t use the `@` alias (rare)

```fish
# Find relative imports that reach across folders (optional audit)
rg -n "from '((\.+\/)+)(components|lib|types|app)\/" src tests | head -n 50
```

5) Typecheck and test

```fish
pnpm typecheck
pnpm test
```

6) Run dev server

```fish
pnpm dev
```

If anything breaks, it’ll most likely be due to hard-coded relative imports between folders; switch those to the `@` alias.

## Optional: Feature-first structure (gradual)

If you want stronger boundaries and clearer ownership, you can gradually adopt a feature-first layout under `src/features/`:

```
src/features/
├─ posts/
│  ├─ ui/           # Components for posts
│  ├─ server/       # Server actions, queries (Drizzle)
│  ├─ lib/          # Feature-specific utilities
│  └─ types/
├─ comments/
│  ├─ ui/
│  ├─ server/
│  ├─ lib/
│  └─ types/
└─ auth/
   ├─ ui/
   ├─ server/
   └─ types/
```

Shared pieces remain in `src/components/` and `src/lib/` until they are clearly feature-scoped.

## Optional: Move Docker assets under deploy/

If you prefer an even cleaner root, move Docker assets and update your docs/scripts:

```fish
mkdir -p deploy/docker
and git mv Dockerfile deploy/docker/Dockerfile
and git mv docker-compose.yml deploy/docker/docker-compose.yml
and git mv docker-compose.prod.yml deploy/docker/docker-compose.prod.yml
```

This is entirely optional; many repos keep these at the root for discoverability.

## Verification Checklist

- pnpm typecheck → PASS
- pnpm test → PASS
- pnpm dev → app boots and routes render
- Basic DB actions via Drizzle still work (paths unchanged under `@`)
- Admin/auth routes accessible
- Scripts in `scripts/` still run (paths use `@`)

## Rationale

- Using `src/` is a common convention in modern Next.js repos; it narrows the search space for application code and declutters the root.
- Keeping `drizzle/`, `public/`, `scripts/`, and `docs/` at root matches widespread OSS practice.
- Preserving the `@` alias prevents sweeping import changes. Only config needs a one-line tweak in both tsconfig and Vitest.
- The plan is incremental and reversible; you can execute it as a single PR and validate via typecheck/tests before merging.

---

If you want, this can be split into two PRs: (1) introduce `src/` + alias updates, (2) consolidate types and optional feature-first seeds.

