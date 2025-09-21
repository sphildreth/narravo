# Narravo - .NET Blog Platform

**ALWAYS follow these instructions first and fallback to additional search and context gathering only if the information here is incomplete or found to be in error.**

Narravo is a lightweight FOSS blog platform built with ASP.NET Core 9, featuring Blazor Server (Admin), Razor Pages (Public), EF Core with SQLite, and Ant Design Blazor for the admin UI. The platform supports WordPress WXR import, fast public site with OutputCache, comments, reactions, and media management.

## Project Structure

Current project layout:
```
/docs/                              # PRD, SPEC, guides, AGENTS.md
/src/
  Narravo.Core/                     # Domain models & enums (classlib)
  Narravo.Data/                     # EF Core DbContext, migrations (classlib) 
  Narravo.Web/                      # Combined Public + Admin (web app)
/tests/
  Narravo.Tests/                    # Unit and integration tests (xunit)
/.github/                           # GitHub workflows and configs
/graphics/                          # Logos, assets
```

> **Note**: Documentation references future structure with separate Public/Admin/Infrastructure projects, but current implementation uses simplified structure above.

## Bootstrap & Build Commands

### Prerequisites
- .NET 8.0+ SDK (currently using .NET 8.0.119)
- EF Core tools: `dotnet tool install --global dotnet-ef`
- (Optional) ffmpeg for video poster generation
- (Optional) Docker for deployment scenarios

### Core Commands
**NEVER CANCEL these commands - wait for completion. Set timeouts appropriately.**

```bash
# Restore packages (< 5 seconds)
dotnet restore

# Build with warnings as errors (5-11 seconds - NEVER CANCEL, set 60+ second timeout)
dotnet build -warnaserror

# Run tests with coverage (5-7 seconds - NEVER CANCEL, set 60+ second timeout)  
dotnet test --collect:"XPlat Code Coverage"

# Format code (required before commits)
dotnet format

# Check format without changes
dotnet format --verify-no-changes
```

### Running the Application

Start the web application:
```bash
cd src/Narravo.Web
dotnet run
```
- **Port**: Usually http://localhost:5290 (check console output)
- **Startup time**: ~3-5 seconds
- **Validation**: `curl http://localhost:5290` should return "Hello World!"

### EF Core Migrations

For database schema changes (once DbContext is implemented):
```bash
# Install EF tools if not available
dotnet tool install --global dotnet-ef

# Add migration (from repo root)
dotnet ef migrations add <MigrationName> -p src/Narravo.Data -s src/Narravo.Web

# Update database
dotnet ef database update -p src/Narravo.Data -s src/Narravo.Web

# List migrations
dotnet ef migrations list -p src/Narravo.Data -s src/Narravo.Web
```

> **Database**: SQLite at `src/Narravo.Web/data/blog.db` with WAL mode enabled  
> **Note**: EF commands require DbContext implementation in Narravo.Data project

## Validation & Testing

### Required Validation Steps
**ALWAYS run these steps after making changes:**

1. **Build validation**: `dotnet build -warnaserror` must succeed
2. **Test validation**: `dotnet test` must pass
3. **Format validation**: `dotnet format --verify-no-changes` must succeed
4. **Manual testing**: Start the web app and verify it responds

### Manual Validation Scenarios
**CRITICAL**: After making changes, always test these workflows:

#### Basic Application Health
1. Start web app: `cd src/Narravo.Web && dotnet run`
2. Verify response: `curl http://localhost:5290`
3. Check console for errors or warnings
4. Stop with Ctrl+C

#### For Database Changes
1. Run migration: `dotnet ef database update -p src/Narravo.Data -s src/Narravo.Web`
2. Start web app and verify no startup errors
3. Check database file exists: `ls -la src/Narravo.Web/data/blog.db`

#### For UI Changes (Future)
- Test key user journeys: homepage → post detail → comments
- Verify responsive design works
- Test admin login flow (when implemented)
- Check accessibility with keyboard navigation

## Time Expectations & Timeouts

**CRITICAL**: Always use appropriate timeouts and NEVER CANCEL builds:

| Command | Expected Time | Recommended Timeout |
|---------|---------------|-------------------|
| `dotnet restore` | < 2 seconds | 30 seconds |
| `dotnet build` | ~5-11 seconds | 60 seconds |
| `dotnet test` | ~5-7 seconds | 60 seconds |
| `dotnet run` startup | ~3-5 seconds | 30 seconds |
| `dotnet format` | ~8-10 seconds | 60 seconds |
| `dotnet clean` | < 1 second | 30 seconds |
| EF migrations | ~5-15 seconds | 60 seconds |

**NEVER CANCEL** any of these operations even if they seem to hang. Build times may vary significantly on different systems.

## Development Guidelines

### Code Style & Quality
- **C#**: `nullable enable`, `ImplicitUsings enable`
- **Analyzers**: Treat warnings as errors (`-warnaserror`)
- **Formatting**: Run `dotnet format` before committing
- **Async**: Use `async/await` for I/O operations
- **Security**: Never trust client HTML; sanitize on save/render

### Database Patterns
- **SQLite-first**: Keep code compatible with SQLite
- **Migrations**: Hand-authored for SQLite compatibility
- **Transactions**: Keep write transactions small
- **Idempotency**: Migrations must be safe to run multiple times

### Testing Strategy
- **Unit tests**: Domain models, business logic, utilities
- **Integration tests**: End-to-end workflows, database operations
- **Coverage**: Focus on meaningful coverage over raw percentages
- Add tests for any new features or bug fixes

### Common Troubleshooting

#### Build Failures
```bash
# Clean and rebuild
dotnet clean
dotnet restore
dotnet build
```

#### Database Issues
```bash
# Check migrations status (requires DbContext implementation)
dotnet ef migrations list -p src/Narravo.Data -s src/Narravo.Web

# Reset database (CAUTION: data loss) 
rm src/Narravo.Web/data/blog.db
dotnet ef database update -p src/Narravo.Data -s src/Narravo.Web
```

#### Port Conflicts
- Check `src/Narravo.Web/Properties/launchSettings.json` for port configuration
- Use `dotnet run --urls "http://localhost:5555"` for custom port

## File Locations Reference

### Key Configuration Files
- `Narravo.sln` - Solution file
- `src/Narravo.Web/appsettings.json` - App configuration
- `src/Narravo.Web/Program.cs` - Application startup
- `docs/AGENTS.md` - Agent-specific guidelines
- `docs/CONTRIBUTING.md` - Development workflow

### When Adding Features
- **Domain models**: `src/Narravo.Core/`
- **Data access**: `src/Narravo.Data/`  
- **Web controllers/pages**: `src/Narravo.Web/`
- **Tests**: `tests/Narravo.Tests/`
- **Documentation**: `docs/` directory

### Generated/Ignored Files
- `bin/`, `obj/` directories (build outputs)
- `src/Narravo.Web/data/blog.db` (SQLite database)
- `TestResults/` (test coverage reports)

## Commit & PR Guidelines

### Commit Format
Use Conventional Commits:
- `feat(admin): add post editor with preview`
- `fix(public): correct sitemap date format` 
- `chore(ci): enable dotnet format check`

### PR Requirements
- Keep PRs < 400 lines when possible
- Include screenshots for UI changes
- Document migration steps for schema changes
- Verify all validation steps pass
- Add "Fixes #N" to link issues

## CI/CD Expectations

The project expects GitHub Actions workflows to validate:
- `dotnet build -warnaserror` passes
- `dotnet test` passes  
- `dotnet format --verify-no-changes` passes
- No secrets committed

Always run these commands locally before pushing to ensure CI success.

---

**Remember**: These instructions are your primary reference. Only search for additional context if you encounter unexpected behavior or missing information not covered here.