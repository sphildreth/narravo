<!-- SPDX-License-Identifier: Apache-2.0 -->
# REQ_ANALYTICS — In‑House View Analytics (MVP)

Goal
- Add privacy‑respecting page view tracking to power:
  - View counts on Post page and cards
  - Trending posts (last 7 days)
  - Admin sparkline per post (daily views)

Scope
- Track anonymous views per post with minimal metadata
- Store daily aggregates + optional raw events (for future)
- Exclude obvious bots; respect Do Not Track (DNT)
- Provide simple queries/helpers for UI

Non‑Goals (for later)
- Cross‑device user attribution, funnels, A/B tests, heatmaps
- PII storage or precise geo

Implementation overview
- Client beacon (on post page): send postId once per page load
- API route: validates/filters, writes event and daily aggregate, 204 fast
- DB schema: posts.views_total, post_daily_views, post_view_events (optional now, helpful later)
- Server helpers: recordView, getTrending, getPostViewCounts, getPostSparkline
- UI: show view counts, trending section, admin analytics page with sparkline

Configuration (seed‑required)
Use ConfigServiceImpl — do not hardcode tunables.
- VIEW.SESSION-WINDOW-MINUTES (integer) = 30
- VIEW.TRENDING-DAYS (integer) = 7
- VIEW.ADMIN-SPARKLINE-DAYS (integer) = 30
- VIEW.REVALIDATE-SECONDS (integer) = 60
- VIEW.COUNT-BOTS (boolean) = false
- VIEW.RESPECT-DNT (boolean) = true
- RATE.VIEWS-PER-MINUTE (integer) = 120
- SYSTEM.CACHE.DEFAULT-TTL (integer, minutes) — existing
Environment
- ANALYTICS_IP_SALT: random secret used to hash IPs; if missing, store null ip_hash

Data model & migrations
Drizzle schema changes (drizzle/schema.ts)
- posts table: add viewsTotal integer("views_total").notNull().default(0)
- post_daily_views table
  - day date("day").notNull()
  - postId uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull()
  - views integer("views").notNull().default(0)
  - uniques integer("uniques").notNull().default(0)
  - primary key (day, post_id)
  - indexes on (post_id, day)
- post_view_events table (optional but recommended)
  - id uuid pk defaultRandom()
  - postId uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull()
  - ts timestamp("ts", { withTimezone: true }).default(sql`now()`)
  - sessionId text("session_id")
  - ipHash text("ip_hash")
  - userAgent text("user_agent")
  - referrerHost text("referrer_host")
  - referrerPath text("referrer_path")
  - userLang text("user_lang")
  - bot boolean("bot").notNull().default(false)
  - unique index for dedupe (post_id, session_id, date(ts)) optional via partial upsert logic

Migration
- Create a new migration with the next sequential number (e.g., 0002_analytics_views.sql) to:
  - ALTER TABLE posts ADD COLUMN views_total integer NOT NULL DEFAULT 0
  - CREATE TABLE post_daily_views (...)
  - CREATE TABLE post_view_events (...)
  - CREATE INDEXES as noted
- Update drizzle/migrations/meta/_journal.json accordingly via drizzle-kit

API contract — POST /api/metrics/view
Route file: app/api/metrics/view/route.ts
Request
- Method: POST
- Body JSON: { postId: string }
- Headers used (from request):
  - referer (optional)
  - user-agent
  - dnt ("1" means do not track)
  - accept-language
  - x-forwarded-for / request.ip (platform dependent)
Response
- 204 No Content on success or filtered noop
- 400 if invalid postId format or not found (optional: return 204 to avoid probing)
Behavior
1) If VIEW.RESPECT-DNT and DNT=1 → fast 204, skip
2) Derive client IP; compute ipHash = HMAC_SHA256(ANALYTICS_IP_SALT, ip). If no salt, ipHash = null
3) Detect bots (simple UA regex; if VIEW.COUNT-BOTS=false and bot=true) → 204 skip
4) Parse referer host/path and accept-language (primary)
5) Read/view session id from header cookie/localStorage token sent by client (see client section). If missing, a server‑generated short‑lived session is acceptable, but prefer client managed.
6) Dedupe window: if a record exists for (postId, sessionId) within VIEW.SESSION-WINDOW-MINUTES, do not increment (event may still be recorded once per window); else increment
7) Writes (in one transaction):
   - Option A (MVP): upsert aggregate only
     - UPDATE posts SET views_total = views_total + 1 WHERE id = :postId
     - INSERT INTO post_daily_views(day, post_id, views, uniques) VALUES (current_date, :postId, 1, 1?)
       ON CONFLICT (day, post_id) DO UPDATE SET views = post_daily_views.views + 1, uniques = post_daily_views.uniques + (isUnique ? 1 : 0)
   - Option B (full): INSERT post_view_events(...) with bot flag; same aggregate upserts
8) Return 204
Rate limiting
- Apply basic limiter by ipHash per minute using RATE.VIEWS-PER-MINUTE. If Slice H lib exists, reuse; else in‑memory Map with rolling window (dev only)

Client beacon — ViewTracker
File: components/analytics/ViewTracker.tsx (client component)
Props: { postId: string }
Behavior
- On first mount, schedule navigator.sendBeacon('/api/metrics/view', Blob(JSON))
- Fallback to fetch POST if sendBeacon unavailable
- Manage a rolling session id in localStorage: key "va:session", value { id: string, expiresAt: epochMs }. Renew if expired every VIEW.SESSION-WINDOW-MINUTES. Include sessionId in the request body to aid dedupe server‑side
- Avoid firing in Next.js preview mode if applicable
- Avoid firing on server
Edge cases
- If localStorage unavailable, send without sessionId
- On client navigations, component remounts and fires; server dedupe prevents double counting within window

Server helpers (lib/analytics.ts)
- async recordView(input: { postId: string, sessionId?: string, ip?: string, ua?: string, referer?: string, lang?: string }): applies rules above; used by API route
- async getTrendingPosts({ days, limit }): returns array of PostDTO with viewsLastNDays; query from post_daily_views sum over N days, join posts
- async getPostViewCounts(postIds: string[]): returns { postId, totalViews, viewsLastNDays } map for batch decorating cards
- async getPostSparkline(postId: string, days: number): returns array of { day: string(YYYY-MM-DD), views: number }

UI integrations
1) Post page (app/(public)/[slug]/page.tsx)
- Import and render <ViewTracker postId={post.id} /> near top of main content
- Display view count: fetch from getPostViewCounts([id]) in RSC and render (e.g., "1,234 views")
2) Post cards (components/ArticleCard.tsx and components/posts/PostCard.tsx)
- Extend post DTO to include viewsLastNDays or totalViews; show in metadata row
- Adjust listPosts to optionally join aggregate for last N days (config VIEW.TRENDING-DAYS)
3) Home “Trending” (app/page.tsx or a new section component)
- Use getTrendingPosts({ days: VIEW.TRENDING-DAYS, limit: FEED.LATEST-COUNT })
- Cache with unstable_cache, key includes days+limit; revalidate VIEW.REVALIDATE-SECONDS; tag "analytics:trending"
4) Admin sparkline (new route: app/(admin)/admin/analytics/page.tsx)
- requireAdmin()
- List recent posts with total views and a sparkline using getPostSparkline(postId, VIEW.ADMIN-SPARKLINE-DAYS)
- Simple inline SVG sparkline component (no external deps)

Bot filtering (MVP)
- UA contains case‑insensitive: bot, spider, crawl, slurp, headless, puppeteer, selenium, playwright, httpclient
- If UA missing, treat as bot unless referer present (tunable)

Privacy
- Respect DNT
- Hash IP via HMAC with ANALYTICS_IP_SALT; do not store raw IP
- Do not store full referer URL beyond host/path; no query/UTM (strip search params)
- No cookies required; localStorage session id is pseudonymous

Caching & correctness
- API returns 204 quickly; DB ops minimal; transaction or careful sequence to avoid double increment
- Use UPSERT for post_daily_views; maintain uniques via session‑based dedupe
- Ensure timezone consistency (use UTC dates)

Testing
Unit
- Dedup logic by session within window
- Day bucketing and UPSERT update counts
- UA bot detector
Integration (vitest + supertest/undici)
- POST /api/metrics/view increments totals and daily
- Second POST within window with same sessionId does not increment
- With DNT=1, no increment
- With bot UA and VIEW.COUNT-BOTS=false, no increment
- Trending query sorts correctly by last 7 days
- Sparkline returns contiguous days including zeros
UI smoke
- View count renders on post page
- Trending section shows expected posts order in a seeded dataset
- Admin analytics page renders sparkline SVGs

Verification commands
```bash
# Pre-reqs
pnpm i
pnpm seed:config
pnpm drizzle:generate
pnpm drizzle:push

# Build & test
pnpm build
pnpm test

# Run
pnpm dev
```

Acceptance criteria
- Opening a post triggers exactly one count within the session window
- Post page displays a human‑readable view count
- Home trending shows posts ordered by last N days view totals
- Admin analytics page lists posts with a working sparkline for last N days
- DNT and bot filtering rules observed; rate limit enforced

File/Module checklist
- drizzle/schema.ts — add viewsTotal, post_daily_views, post_view_events
- drizzle/migrations/0002_analytics_views.sql — create tables/indexes/column
- app/api/metrics/view/route.ts — POST handler
- components/analytics/ViewTracker.tsx — client beacon
- lib/analytics.ts — server helpers
- lib/posts.ts — extend listPosts/getPostBySlug to include views aggregates (optional helper)
- components/ArticleCard.tsx — display views meta
- components/posts/PostCard.tsx — display views meta
- app/(public)/[slug]/page.tsx — render ViewTracker + count
- app/(admin)/admin/analytics/page.tsx — admin sparkline page
- tests/analytics.test.ts — unit+integration for above

Open questions / decisions (leave TODOs if not implemented now)
- Do we want to show uniques vs. total in UI? For MVP show total
- Should invalid postId return 204 or 400? Prefer 204 to avoid probing
- Should we log raw events in production? Optional; keep table behind config toggle
- Consent banner? Out of scope for MVP; respect DNT and document in privacy policy

