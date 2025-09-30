# Overview

Analyze the project and perform a code coverage analysis. Create a plan of tasks to implement unit tests to increase code coverage to a minimum of 80%. 

# Code Coverage Analysis

The current code coverage is **21.94%**.

## Coverage Summary
| File                       | % Stmts | % Branch | % Funcs | % Lines |
|----------------------------|---------|----------|---------|---------|
| All files                  | 21.94   | 72.3     | 63.82   | 21.94   |
| narravo/drizzle            | 86.94   | 100      | 0       | 86.94   |
| narravo/scripts            | 40.31   | 71.95    | 90.9    | 40.31   |
| narravo/src/lib            | 51.99   | 74.27    | 62.22   | 51.99   |
| narravo/src/app            | 0       | 100      | 100     | 0       |
| narravo/src/components     | 0       | 100      | 100     | 0       |

# Plan to Increase Code Coverage to 80%

## Phase 1: Core Libraries (src/lib)

- [ ] Write tests for `src/lib/auth.ts` to cover user authentication logic.
- [ ] Increase coverage for `src/lib/comments.ts` to handle all comment-related functionality.
- [ ] Add more tests for `src/lib/config.ts` to cover all configuration scenarios.
- [ ] Write tests for `src/lib/db.ts` to cover all database interactions.
- [ ] Improve coverage for `src/lib/posts.ts` to cover all post-related functionality.
- [ ] Write tests for `src/lib/reactions.ts` to cover all reaction-related functionality.
- [ ] Write tests for `src/lib/redirects.ts` and `src/lib/redirectsEdge.ts`.
- [ ] Write tests for `src/lib/revalidation.ts`.
- [ ] Write tests for `src/lib/rss.ts`.
- [ ] Improve coverage for `src/lib/s3.ts`.
- [ ] Write tests for `src/lib/seo.ts`.
- [ ] Improve coverage for `src/lib/taxonomy.ts`.

## Phase 2: Scripts (scripts)

- [ ] Write tests for `scripts/add-spdx.ts`.
- [ ] Write tests for `scripts/backup.ts`.
- [ ] Write tests for `scripts/restore.ts`.
- [ ] Write tests for `scripts/seed-config.ts`.
- [ ] Write tests for `scripts/seed-posts.ts`.
- [ ] Write tests for `scripts/perf/*.ts`.

## Phase 3: UI Components (src/components and src/app)

- [ ] Write tests for all components in `src/components`.
- [ ] Write tests for all pages in `src/app/(public)`.
- [ ] Write tests for all pages in `src/app/(admin)`.
- [ ] Write tests for all API routes in `src/app/api`.
