# Narravo Repository — Codex Audit & Update Job Brief (v1)
**Date:** 2025-09-21
**Repo:** https://github.com/sphildreth/narravo (branch: `initial-work`)
**Primary Doc:** `docs/PRD_SPEC_IMPLEMENTATION_SLICES.md`

## Goal
Review the PRD/Spec slices and verify that every item marked **Complete** (or checked) is truly implemented in code and covered by minimal tests/docs. For items that are **not** implemented (or are partially implemented), update the PRD to reflect accurate status and generate concrete, scoped tasks/patches to move them to completion while maximizing reuse of the existing code.

> You are operating *inside the repo root* when this brief is used. Assume filesystem access to the codebase and docs.

## What to read first
1. `docs/PRD_SPEC_IMPLEMENTATION_SLICES.md` (source of truth for slices/status)
2. Project readmes & setup: `README.md`, any `/docs/*.md`
3. App entry points and structure: `app/`, `src/`, `components/`, `lib/`, `server/` (or equivalent per repo)
4. Data layer: schema/migrations (e.g., Drizzle/Prisma), seed scripts, and runtime data access code.
5. Routing and UI shells/layouts (e.g., Next.js app router, Blazor, etc.).

## Known context (from prior discussions)
- A **published** column mismatch existed: code referenced `published` but schema used `published_at`. Confirm consistency across schema, models, and queries.
- `ArticleCard.tsx`, `Prose.tsx`, and `Sidebar.tsx` had hard-coded content. Verify they now render from the DB and follow prop-driven patterns.
- The project aims to standardize on **TypeScript**. Confirm types across APIs, components, and server code.
- Aim for quality & leverage what’s already in place rather than rewriting from scratch.

## Deliverables
1. **Status Report (Markdown)**: Table per slice with columns: *Slice*, *Spec Status*, *Actual Status*, *Evidence (files/lines)*, *Gaps*, *Fix Plan*.
2. **Doc Updates (PRD)**: Edit `docs/PRD_SPEC_IMPLEMENTATION_SLICES.md` to correct statuses and add missing acceptance criteria where vague.
3. **Task List (Issues.md)**: Write `docs/Narravo_Tasks.md` containing actionable tasks grouped by slice; each task <= 1–2 hours, referencing files.
4. **Optional Patches**: Where changes are trivial and low-risk, produce diffs/patches in `patches/` and a summary in `docs/PATCHLOG.md`.

## Verification rubric for a slice marked “Complete”
A slice is truly **Complete** only if all are true:
- **Code exists** and is reachable through the app (linked from UI routes or services).
- **Types** are present (TypeScript types or interfaces) and pass strict-ish checks (`tsc --noEmit` or project default).
- **Schema** and **queries** align (column names, nullability, enum/string literals).
- **Tests**: minimal happy-path test exists (unit/integration) *or* a manual test script documented.
- **Docs**: brief usage notes or comments exist where complexity warrants.
- **No hard-coded demo data** in UI components or services.
- **Lint/format** passes. No obvious dead code around the feature.

## Method
1. **Map the repo**
   - List key folders and their purpose.
   - Build a quick route map and data flow sketch (file paths + brief notes).

2. **Read the PRD slices**
   - Parse the list of slices and their marked statuses.
   - For each slice, derive expected code surface (files/modules, routes, database tables/columns, services).

3. **Evidence-driven checks**
   - Search the repo for implementations, e.g. component names, server handlers, schema entities.
   - Confirm names and signatures. Cross-check UI → service → data layer.
   - For the “published vs published_at” issue: trace from schema → model → API → UI.

4. **Decide Actual Status**
   - Mark **Implemented**, **Partially Implemented**, or **Missing**.
   - Note deviations from spec and propose minimal, high-leverage fixes.

5. **Produce outputs**
   - Write the Status Report.
   - Apply edits to `docs/PRD_SPEC_IMPLEMENTATION_SLICES.md` with accurate statuses and acceptance criteria.
   - Create `docs/Narravo_Tasks.md` with small, scoped tasks (title, rationale, file paths, est. time).
   - If trivial changes unblock a slice (e.g., replace hard-coded data with props/query), include a patch in `patches/` with clear diff.

## Conventions and constraints
- Prefer **incremental** fixes over rewrites.
- Keep new deps conservative and agent-friendly.
- Preserve existing patterns (styling, state mgmt, routing) unless the spec explicitly calls for a change.
- Add tests only where value/cost is obvious (smoke/integration OK).

## Reporting format templates

### A) Status Report (insert real rows)
```md
| Slice | Spec Status | Actual Status | Evidence | Gaps | Fix Plan |
|------|--------------|---------------|----------|------|----------|
| Posts list | Complete | Partially Implemented | `app/posts/page.tsx` L45-82, `db/schema/posts.ts` L10-35 | `published_at` mismatch; hard-coded card | Rename column or map field; parameterize ArticleCard props; add query |
```

### B) Tasks (`docs/Narravo_Tasks.md`)
```md
## Slice: Posts list
- [ ] Replace hard-coded `ArticleCard` with props mapped from DB query (files: `components/ArticleCard.tsx`, `app/posts/page.tsx`) — 1h
- [ ] Align schema + model: adopt `published_at` everywhere, add migration if needed (files: `db/schema/*`, migrations) — 1h
- [ ] Add simple test: render posts page with mock data path — 45m
```

### C) PATCHLOG (`docs/PATCHLOG.md`)
```md
## 2025-09-21
- components/ArticleCard.tsx: accept `title`, `excerpt`, `href`, `publishedAt`; remove hard-coded markup.
- app/posts/page.tsx: fetch posts; map to ArticleCard props; handle empty state.
```

## Acceptance criteria for this audit
- PRD statuses reflect reality as of the audit.
- A contributor can pick up tasks from `docs/Narravo_Tasks.md` and make progress in < 2 hours without further guidance.
- No regressions introduced by trivial patches; lint/build OK.

## Execution notes for Codex
- Work from repo root.
- Read and summarize `docs/PRD_SPEC_IMPLEMENTATION_SLICES.md`.
- Build the Status Report table.
- Propose minimal diffs; if safe, author patches and include in `patches/`.
- Output paths and line references in the report for every claim.