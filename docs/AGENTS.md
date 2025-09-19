# AGENTS.md — Automation & Coding Agents Guide

This guide outlines **what tasks are safe to automate**, constraints to follow, and the acceptance criteria agents must meet.

## Scope of agent work (safe to automate)

- **Boilerplate CRUD** in Admin (Blazor + Ant Design Blazor)
- **Razor Pages** scaffolds for Public (list/detail, archives)
- **EF Core** migrations *that don’t drop data* and add proper indexes
- **OutputCache** tag wiring and evictions on domain events
- **Import pipeline** expansions (WXR field mapping) with fixtures
- **Backup/Restore** enhancements (manifest, selective restore)
- **SEO**: RSS/sitemap generators, canonical/OG tags
- **Docs**: feature guides, troubleshooting, getting-started

> Avoid large architectural changes or provider-specific SQL unless the task explicitly calls for it.

## Guardrails & constraints

- **Idempotency**: migrations and batch jobs must be safe to run twice.
- **No secrets**: use placeholders for OAuth, connection strings, API keys.
- **SQLite-first**: keep code compatible with SQLite; abstract provider-specific logic behind interfaces.
- **Sanitization**: never render or store user HTML without server-side sanitizing.
- **Accessibility**: UI changes must preserve keyboard/focus and color-contrast guidelines.
- **Performance**: write transactions must be small; do not hold connections for long-running operations.

## Definition of done (per task)

- Code compiles (`dotnet build`) and passes linters/formatters.
- Tests added/updated: unit + integration if behavior changes.
- Docs updated if user-visible change (README or a doc under `/docs`).
- Screenshots/gifs for UI changes in the PR description.
- No secrets in code or history.

## Project structure expectations

Use these current paths:

```
/src/Narravo.Core
/src/Narravo.Infrastructure
/src/Narravo.Public
/src/Narravo.Admin
/src/Narravo.Tools.Export
/docs
/brand
/scripts
```

## Task templates (copy into GitHub issues)

### 1) Feature slice
**Summary**: <what the user needs>  
**Spec refs**: PRD sections + acceptance criteria  
**Deliverables**:
- [ ] Implement <feature>
- [ ] Unit tests for <cases>
- [ ] Update docs at `/docs/<feature>.md`
- [ ] Screenshots/gif of UI
  **Acceptance**:
- [ ] All AC in PRD pass
- [ ] `dotnet build && dotnet test` green

### 2) EF migration change
**Summary**: Add/modify schema for <entity>  
**Deliverables**:
- [ ] EF migration created and reviewed
- [ ] Indexes/uniques defined
- [ ] Backfill script or data-safe defaulting
  **Acceptance**:
- [ ] Can run migration on a copy of sample DB without data loss
- [ ] Queries show expected plan (indexes used)

### 3) Import mapping
**Summary**: Map WXR field(s) → internal model(s)  
**Deliverables**:
- [ ] Parser updated
- [ ] Fixture WXR added under `/tests/Fixtures/WXR/...`
- [ ] Report shows counts & errors
  **Acceptance**:
- [ ] Sample WXR imports with >95% success
- [ ] Unknown shortcodes logged & preserved

## Verification commands

```bash
dotnet restore
dotnet build -warnaserror
dotnet test --collect:"XPlat Code Coverage"
```

For EF changes:
```bash
dotnet ef database update -p src/Narravo.Infrastructure -s src/Narravo.Public
```

## PR hygiene

- Conventional commit in title.
- Keep PRs < 400 lines if possible; split otherwise.
- Include before/after screenshots for UI.

---

Agents should comment the exact files they modified and why, and link lines in PRs that implement each acceptance criterion.
