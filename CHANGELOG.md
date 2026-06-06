# Changelog

This file records notable project changes. It follows the
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-06

### Added

- Added the first root changelog for release tracking, starting with the
  `1.0.0` release.
- Added a pnpm 11 workspace configuration with dependency overrides,
  peer-dependency rules, and build-script approval settings.
- Added a Docker ignore file to keep local dependencies, build outputs,
  private environment files, backups, and uploaded media out of image build
  context.
- Added database indexes for published post feed lookups, post category
  lookups, comment tree/moderation queries, comment parent lookups, and
  comment attachment joins.
- Added a generated migration for the new index set.
- Added CI typechecking as an explicit required step.
- Added stricter CI runtime environment defaults for Auth.js, admin access,
  analytics salt, telemetry, and the test database.

### Changed

- Bumped the application version from `0.7.4` to `1.0.0`.
- Updated dependencies to current resolved package versions, including Next.js
  16.2, React 19.2, TypeScript 6.0, Vite 8, Vitest 4, Tailwind 4, Drizzle ORM
  0.45.2, DOMPurify 3.4, Mermaid 11.15, and related tooling.
- Updated the package manager declaration to pnpm 11.5.2.
- Updated CI from Node.js 20/global pnpm installation to Node.js 22 with
  Corepack-managed pnpm.
- Updated TypeScript configuration for TypeScript 6 compatibility.
- Updated Vitest configuration to use Vite's native TypeScript path support.
- Updated Docker builds and runtime images to Node.js 22.
- Updated the Docker runtime image to copy the actual Next config,
  `pnpm-workspace.yaml`, `drizzle.config.ts`, migrations, scripts, and source
  files needed by runtime migration and app startup paths.
- Updated the production entrypoint to run migrations with pnpm and stop
  logging `DATABASE_URL`.
- Rewrote the README to match the current `1.0.0` stack, setup flow,
  configuration, database commands, data operations, WXR import options,
  security posture, deployment notes, and quality gates.
- Updated admin server actions and admin mutation APIs to require verified 2FA
  through `requireAdmin2FA`.
- Updated import job listing to use the shared admin 2FA guard.
- Updated local upload handling to require an authenticated session rather than
  admin access, matching comment-upload usage while preserving upload
  tracking.
- Updated comment upload handling to support both direct `PUT` presigned S3/R2
  uploads and local multipart uploads.
- Updated production CSP generation to avoid development-only `unsafe-eval`,
  narrow `connect-src`, and include configured S3/R2 hosts.

### Fixed

- Fixed the GitHub Actions CI workflow so dependency installation, migrations,
  typechecking, build, and tests run under the versions and environment the
  project now expects.
- Fixed Docker image build/runtime issues caused by stale file copies and
  missing runtime configuration files.
- Fixed presigned upload signing to reject missing, non-finite, zero, and
  oversized content lengths.
- Fixed presigned S3/R2 upload commands to include validated content length.
- Fixed `/api/r2/sign` so unauthenticated requests receive auth-specific
  responses instead of a generic internal error.
- Fixed local upload auth error mapping so unauthorized and forbidden cases
  return appropriate status codes and error codes.
- Fixed test mocks and expectations for admin 2FA guarded routes/actions.
- Fixed local upload tests so authenticated upload tracking does not violate
  user foreign-key constraints.
- Fixed admin allowlist unit-test isolation when CI provides `ADMIN_EMAILS`.
- Fixed README drift, duplicate sections, corrupted heading characters, stale
  badge versions, npm command examples, and outdated test-count claims.
- Fixed the Performance GitHub Actions workflow to use Node.js 22 and
  Corepack-managed pnpm, matching the main CI runtime.

### Security

- Hardened admin mutation surfaces by requiring recent 2FA verification for
  post management, user management, moderation, data operations, configuration,
  purge/restore/export, banner uploads, and import job access.
- Hardened `/api/r2/sign` by requiring an authenticated session before issuing
  upload credentials.
- Hardened upload validation by binding presigned uploads to the validated
  client-reported content length.
- Hardened production CSP by removing development-only script evaluation and
  limiting connection targets to configured storage endpoints.
- Updated vulnerable direct and transitive dependency ranges where current
  package updates could resolve them.
- Resolved the remaining `pnpm audit` advisories for transitive `yaml`,
  `postcss`, and `uuid` usage with package overrides and dev-only placement for
  performance tooling.

### Noted

- GitHub Dependabot alerts may lag behind local dependency changes until the
  branch is pushed and GitHub refreshes the dependency graph.
- Current backup archives include database JSON exports and media-reference
  manifests, but not full remote media payloads.
- Current restore support focuses on posts, users, and configuration, with
  dry-run, slug/date filters, and skip options.

## Pre-1.0.0

Earlier releases were tracked through Git tags and pull requests before this
changelog was introduced.
