# Contributing to Narravo

Welcome! This document explains how to build, run, test, and contribute code to Narravo.
It reflects the current repo layout:

```
/brand/                             # Logos, wordmarks, prompts
/docs/                              # PRD, SPEC, guides
/scripts/                           # Helper scripts (e.g., create_solution.*)
/src/
  Narravo.Core/                     # Domain models & enums
  Narravo.Infrastructure/           # EF Core DbContext, migrations, import, seed
  Narravo.Public/                   # Public site (Razor Pages + OutputCache)
  Narravo.Admin/                    # Admin (Blazor Server + Ant Design Blazor)
  Narravo.Tools.Export/             # Static export CLI
```

## Development quickstart

### 0) Requirements
- .NET 9 SDK
- (Optional) ffmpeg for comment-video posters
- (Optional) Docker + Docker Compose (for reverse proxy later)

### 1) Create the solution
```bash
cd scripts
./create_solution.sh    # Windows: .\create_solution.ps1
```

### 2) Restore & run (SQLite, default)
Public (seeds a sample post):
```bash
cd ../src/Narravo.Public
dotnet restore
dotnet run
```

Admin (OAuth placeholders are fine for local no-auth pages like /login):
```bash
cd ../Narravo.Admin
dotnet restore
dotnet run
```

> SQLite DB is at `src/Narravo.Public/data/blog.db`. The app enables WAL and uses `busy_timeout` by default.

### 3) Configure OAuth (optional for local)
Edit `src/Narravo.Admin/appsettings.json`:
```json
{
  "Authentication": {
    "Google": { "ClientId": "...", "ClientSecret": "..." },
    "GitHub": { "ClientId": "...", "ClientSecret": "..." }
  }
}
```

### 4) EF Core migrations
Migrations are currently hand-authored for SQLite. If you modify models:

```bash
# From repo root (after creating Narravo.sln):
dotnet tool restore
dotnet ef migrations add <Name> -p src/Narravo.Infrastructure -s src/Narravo.Public
dotnet ef database update -p src/Narravo.Infrastructure -s src/Narravo.Public
```

> Public uses the same DbContext to ensure the DB exists and seeds on first run.

---

## Code style & quality

- **C#**: `nullable enable`, `ImplicitUsings enable`. Prefer records/readonly where appropriate.
- **Analyzers**: enable .NET analyzers; treat warnings as errors in CI.
- **Formatting**: `dotnet format` before committing.
- **Naming**: `PascalCase` for types/properties; `camelCase` for locals/parameters; `_camelCase` for private fields.
- **Async**: `async/await` end-to-end on I/O; avoid blocking calls.
- **Security**: never trust client HTML; sanitize on save and render. Add CSP/HSTS headers.
- **Secrets**: never commit real client IDs or secrets; use `appsettings.Development.json`, `dotnet user-secrets`, or env vars.

---

## Tests

- **Unit tests**: models, sanitization, reaction toggles, archive grouping, banner contrast.
- **Integration**: WXR import (fixtures), backup/restore roundtrip, OAuth login (mock).
- **Perf smoke**: simple load of `/posts/{slug}` warm cache to catch regressions.

> Add tests per feature; aim for meaningful coverage instead of raw %.

---

## Commit & PR guidelines

- **Conventional Commits** (examples):
    - `feat(admin): add post editor with preview`
    - `fix(public): correct sitemap date format`
    - `chore(ci): enable dotnet format check`
- **Small PRs** with focused scope; include:
    - what changed and why,
    - screenshots/gifs for UI,
    - migration notes if schema changed,
    - how to test locally.

---

## Branching & releases

- `main` = latest, green build.
- Tag releases; publish artifacts (zips/images) from GitHub Actions.

---

## Running with Caddy (optional, later)

We will ship `compose.sqlite.yml` and a `Caddyfile` to simplify HTTPS in self-hosted scenarios. For MVP, native `dotnet run` is fine.

---

## Where to change what

- New entities: `src/Narravo.Core` (models) + `src/Narravo.Infrastructure` (DbContext, migrations).
- Public routes or SEO: `src/Narravo.Public` (Program.cs, Pages/, Services/Seo.cs).
- Admin UX: `src/Narravo.Admin` (Pages, Shared, AntDesign components).
- Static export: `src/Narravo.Tools.Export` (Program.cs).

---

## Issue labels (suggested)

`good-first-issue`, `help-wanted`, `area-admin`, `area-public`, `area-infra`, `import`, `backup-restore`, `seo`, `accessibility`, `performance`, `documentation`.

---

Thanks for contributing! Open a discussion before large refactors or datastore/provider changes to keep the roadmap tidy.
