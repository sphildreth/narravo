Project: Narravo (Blazor Admin + Razor Pages Public, EF Core + SQLite)
Goal: Implement <feature> per PRD & Implementation Guide.

Context
- Repo layout:
  /src/Narravo.Core, /src/Narravo.Infrastructure, /src/Narravo.Public, /src/Narravo.Admin
  /docs (PRD_SPEC_Narravo_full.md, PRD_SPEC_IMPLEMENTATION_Augmented.md), /brand, /scripts
- DB: SQLite (WAL enabled), EF Core, migrations in Narravo.Infrastructure, DbContext = BloggingDbContext
- Security: server-side HTML sanitization; rate limits on write endpoints
- Caching: OutputCache tags (home, post:{id}, term:{id}, archive:{yyyy-mm})
- Style: nullable enable, analyzers on, Conventional Commits

Scope (Do exactly this; nothing more)
1) <bullet list of concrete changes with exact URLs, models, and files to touch>
2) …
3) …

Acceptance Criteria (must all pass)
- <AC #1>
- <AC #2>
- <AC #3>

Deliverables
- Code changes in appropriate projects with unit/integration tests
- Docs updated in /docs/<topic>.md
- Screenshots/GIFs for any UI
- EF migration (if schema changed) and updated seed if needed

Constraints
- Keep write transactions small; async EF only
- No provider-specific SQL; keep compatible with SQLite
- Sanitize all user HTML on save and render
- Respect rate limits: comments 5/min/IP, reactions 20/min/IP
- No secrets committed; placeholders only

Files to modify / create (proposed)
- <path/to/file1> (new or edit)
- <path/to/file2>
- …

Commands to run (verification)
```bash
    dotnet restore
    dotnet build -warnaserror
    dotnet test --collect:"XPlat Code Coverage"
    # If migrations changed:
    dotnet ef database update -p src/Narravo.Infrastructure -s src/Narravo.Public
```