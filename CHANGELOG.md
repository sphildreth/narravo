# Changelog

This file records notable project changes. It follows the
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.4] - 2026-09-12

### Added

- ESLint is an enforced gate instead of a skipped one. `eslint.config.mjs` applies
  `eslint-config-next` core-web-vitals plus the TypeScript rules to the whole
  workspace, `pnpm lint` runs `eslint . --max-warnings=0` so warnings fail the
  build, `pnpm lint:fix` applies autofixes, and `scripts/do-prechecks.py` runs the
  gate between typecheck and the production build. Every relaxation is scoped to
  named files and states why (`@next/next/no-img-element`, the `react-hooks/*`
  families, `no-console` under `scripts/`, `no-require-imports` for the lazy jsdom
  `require()`), and `docs/DEVELOPMENT.md` records the deferred work.
- Two dependency pins are documented as load-bearing in the config and the dev
  guide: ESLint stays on 9.x because eslint-plugin-react and eslint-plugin-jsx-a11y
  peer ranges stop at `^9` (ESLint 10 removed `context.getFilename`), and
  TypeScript stays on 6.x because typescript-eslint hard-errors on the TypeScript 7
  native API.
- `scripts/do-prechecks.py` runs the local quality gates in fail-fast order
  (`pnpm prechecks`, `pnpm prechecks:quick`), including static release-metadata,
  SPDX, migration-journal, and repository-hygiene checks that CI cannot catch
  before a push. `--install-hook` wires it to `git pre-commit`.
- `scripts/test_do_prechecks.py` covers the precheck tooling itself and runs as
  one of its gates.
- `tests/components/CodeBlockTheme.test.tsx` asserts the highlighter palette
  follows a `<html data-theme>` flip with no navigation; it fails against the
  previous mount-effect implementation.

### Performance

- The site banner and the fixed-size avatars now render through `next/image`
  instead of `<img>`. `Banner` uses `fill` + `priority` + `sizes="100vw"` inside its
  existing `relative h-64 overflow-hidden` wrapper and keeps the configured focal
  point through `objectPosition`; `ArticleCard`, `UserMenu` and `UsersManager` pass
  explicit 20-36px dimensions plus `sizes`, so a small avatar no longer downloads
  the full-size OAuth photo.
- `next.config.mjs` accepts `*.googleusercontent.com` in place of the single
  `lh3.googleusercontent.com` host, so Google accounts served from another
  `*.googleusercontent.com` host render instead of throwing while rendering the
  post list.

### Changed

- Dependency refresh across the workspace (`pnpm update --latest`): Next 16.3.5
  with `@next/bundle-analyzer`/`eslint-config-next` 16.3.5, React 19.3 and matching
  React types, Tiptap 3.31.3, Mermaid 12, Zod 4.6.2, `@simplewebauthn/browser` 14
  and `@simplewebauthn/server` 14.0.1, AWS SDK 3.1131, marked 18.0.12,
  lucide-react 1.45, dompurify 3.4.15, jszip 3.10.2, and on the tooling side
  Vitest 5 with `@vitest/coverage-v8` 5, Vite 8.3, Playwright 1.63 and
  Puppeteer 25.10.
- `pnpm-workspace.yaml` peer rules track what is actually installed:
  `@simplewebauthn/browser`/`@simplewebauthn/server` `>=14` (next-auth/`@auth/core`
  still declare older peers and this app runs its own 2FA implementation) and
  `eslint` `>=9 <10`.
- Internal anchors in the home page footer and the comment sign-in panel use
  `next/link`, and 48 literal `"`/`'` characters in JSX text are escaped as
  `&quot;`/`&apos;`.
- README stack badges follow `package.json` (Next.js 16.3, React 19.3), the README
  gate table and `docs/DEVELOPMENT.md` describe the now-active ESLint gate, and
  `docs/AGENTS.md` lists `pnpm lint` with the other standard commands.
- Tests follow the implementation: the `UserMenu` avatar assertion now expects the
  optimizer URL carrying the original avatar in its `url` parameter and
  `sizes="36px"`, and the remaining test edits drop unused bindings and
  already-dead fixtures.

### Fixed

- Code blocks follow theme changes. `CodeBlock` sampled `<html data-theme>` once in
  a mount effect while `ThemeToggle` rewrites that attribute in place, so toggling
  the theme left every already-rendered code block in the previous palette until a
  reload. The palette now comes from a `useSyncExternalStore` subscription (a
  `MutationObserver` on `data-theme` plus a
  `matchMedia('(prefers-color-scheme: dark)')` listener), with the light palette as
  the server snapshot so hydration output is unchanged and the `matchMedia` lookups
  guarded for jsdom.
- Reaction anti-abuse fails closed: `ReactionButtons` records its mount timestamp
  in an effect, keeping render pure, and reports "now" if a handler somehow runs
  first, so the server-side minimum submit-time check rejects instead of passing.
- `src/app/api/rum/route.ts` exports `runtime = "nodejs"`; it had been a local
  `const` that never configured the route.
- `PostForm`'s featured-image preview effect no longer reads the state it owns: the
  object URL is created and revoked strictly from the selected file.
- Removed the stray top-level `tiptap-markdown` field from `package.json`, which
  duplicated the `devDependencies` entry and was ignored by npm/pnpm.
- Added the missing `Apache-2.0` SPDX headers to `src/lib/rateLimit.ts` and
  `scripts/iframe-allowlist.ts`.

### Removed

- Dead code the lint run exposed: the `Server-Timing` header computation on the post
  page that was never attached to a response, the placeholder audit-log fetch in
  `AuditLogSection` (now an explicit "no endpoint yet" state), the per-request
  `performance.now()` in `proxy()`, the unused query id in
  `createDatabaseInterceptor()`, and unused imports, variables and `catch` bindings
  across `src/` and `tests/`.

### Security

- `lodash-es` is overridden to `>=4.17.24`, closing GHSA-f23m-r3pf-42rh (prototype
  pollution) reached through `mermaid -> chevrotain`; the override stays inside the
  range chevrotain declares and dedupes with the copy `dagre-d3-es` already used.
- `postcss` is pinned to 8.5.28 and `qs` overridden to `>=6.16.0` for the remaining
  advisories; `qs` is reachable only through `@lhci/cli > express`, so it is
  dev-only. `pnpm audit` now reports no known vulnerabilities in production and
  development dependencies.

### Chores

- Ignore `__pycache__/` and `*.py[cod]` so the Python gate tooling leaves no
  noise in `git status`.
- Bumped the application version from `1.0.3` to `1.0.4`.

## [1.0.3] - 2026-08-30

### Security

- Outbound fetches now go through `src/lib/safe-remote-fetch.ts`, which rejects
  internal and non-allowlisted targets before the WXR import action and the
  `wxr:import` script dereference a caller-supplied URL.
- TOTP secrets are encrypted at rest (AES-256-GCM, `enc:v1:` prefix) by
  `src/lib/2fa/totp-secret.ts`. Deployments must set `TOTP_ENCRYPTION_KEY` to a
  32-byte key; existing plaintext secrets are re-wrapped on next use.
- WebAuthn challenges are stored server-side and bound to the ceremony that
  created them (`src/lib/2fa/webauthn-challenge.ts`, migration
  `0021_bound_webauthn_challenges`) instead of travelling through client state.
- MFA verification now yields a short-lived (5 minute) session grant
  (`src/lib/2fa/session-grant.ts`, migration `0019_lowly_reavers`), with
  stale grants purged by `0023_parched_amazoness`, and a WebAuthn step-up
  options endpoint at `POST /api/2fa/step-up/webauthn/options`.
- Rate limiting moved from per-process memory to the shared `rate_limit_bucket`
  table (migration `0020_security_hardening`) via `src/lib/shared-rate-limit.ts`,
  so limits hold across server instances.
- Uploads must pass byte-level type detection and signed completion
  (`src/lib/upload-validation.ts`, `src/lib/upload-signing.ts`,
  `POST /api/r2/complete`), and locally stored uploads are served by the
  hardened `src/app/uploads/[...path]/route.ts` handler.

### Added

- `src/lib/api-error.ts` maps error messages to HTTP status codes and is now
  used across the API routes and server actions.
- Analytics retention support, including the `post_view_events_ts_idx` index
  from migration `0022_analytics_retention`.

### Changed

- Vitest configuration renamed `vitest.config.ts` -> `vitest.config.mts`.

### Tests

- Nine new security-focused suites: SSRF guard, TOTP secret encryption, WebAuthn
  challenge lifecycle, MFA grant binding/consumption, shared rate limiting,
  upload byte validation, R2 completion, and local upload serving.

## [1.0.2] - 2026-08-04

### Security

- Updated `next` from 16.2.7 to 16.2.11 to resolve 8 CVEs (SSRF in rewrites
  and Server Actions, middleware/proxy bypass, DoS in Server Actions, cache
  confusion, unauthenticated Server Function disclosure, and Image Optimization
  DoS).
- Updated `next-auth` from 5.0.0-beta.30 to 5.0.0-beta.32 to resolve 4 CVEs
  (critical auth bypass via fail-open configuration errors, critical email
  homoglyph bypass, uncaught exception on malformed Bearer tokens, and OAuth
  state/nonce/PKCE cookies not bound to provider).
- Updated `@auth/core` from ^0.40.0 to ^0.41.3 to resolve 3 CVEs (critical
  email homoglyph bypass, uncaught exception on malformed Bearer tokens, and
  OAuth state/nonce/PKCE cookies not bound to provider).
- Updated `postcss` from 8.5.15 to 8.5.23 to resolve 2 CVEs (path traversal via
  sourceMappingURL and incomplete fix follow-up).
- Updated `dompurify` from ^3.4.11 to ^3.4.12 to resolve a
  `CUSTOM_ELEMENT_HANDLING` bypass of `afterSanitizeElements`.
- Updated `@next/bundle-analyzer` and `eslint-config-next` to 16.2.11 to match
  the Next.js runtime version.

## [1.0.1] - 2026-06-06

### Added

- Added a repo-managed `deploy/deploy-tag.sh` helper for non-Docker hosts that
  deploy from a Git tag or `origin/main`.
- Added `.node-version` and package `engines` metadata to document and enforce
  the Node.js 22.13+ and pnpm 11.5.2 runtime requirements.

### Changed

- Bumped the application version from `1.0.0` to `1.0.1`.
- Updated LXC deployment documentation from Node.js 20/pnpm 10 to Node.js
  22/pnpm 11 and replaced production schema push guidance with migration-based
  deployment.
- Updated the deploy helper to enable only the pnpm Corepack shim so stale Yarn
  shims on older hosts do not block deployment.

### Fixed

- Fixed direct LXC deployments after `1.0.0` by adding explicit runtime
  preflight checks before dependency installation and build steps.
- Fixed deployment docs and helper flow so database migrations run during
  non-Docker deploys.
- Fixed page/post analytics trackers to avoid avoidable client-side requests
  when the browser advertises Do Not Track or Global Privacy Control.
- Fixed public page/post tracking to honor existing tracking configuration
  flags before rendering client analytics trackers.

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
