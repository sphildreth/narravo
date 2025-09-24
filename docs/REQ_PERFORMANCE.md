# REQ_PERFORMANCE_IMPROVEMENTS.md
Narravo Blog — Performance Benchmarking, Targets, and Improvements

_Last updated: 2025‑09‑23_

## 1) Purpose & Goals
This document defines the requirements to **measure, improve, and continuously monitor** render and load performance for:
- **Public Post pages** (reader experience)
- **Admin Dashboard** (author/operator experience)

Goals:
- Establish **repeatable benchmarks** for SSR/SSG/ISR render time and key web‑vitals.
- Set **SLO-style targets** (p75/p95) for both pages.
- Ship a **small, modern render‑time badge** on Post pages showing server render time in milliseconds.
- Add **regression guards** in CI and production monitoring to prevent performance drift.

## 2) Scope
- App stack: **Next.js (TypeScript)**, Node.js runtime, Postgres (Drizzle ORM), CDN/Proxy (Caddy/NGINX/Vercel‑like edge), image/CDN optimizations.
- Pages in scope: `/posts/[slug]`, `/`, `/admin/*`.
- Devices & networks: Desktop + mid‑range mobile (throttled), 4G/LTE and “Slow 4G” profiles.

Out of scope (for now):
- Third‑party widget performance beyond standard lazy‑loading policies.
- Non‑web clients (mobile apps).

## 3) Definitions
- **Server Render Time (SRT):** Time spent on the server to produce the HTML (SSR or ISR on-demand). Measured in ms.
- **Time To First Byte (TTFB):** Client-observed delay until first byte.
- **Core Web Vitals:** LCP, INP, CLS (plus FCP for early paint).
- **Hydration Time:** Client time from HTML arrival to interactive React tree (if applicable to that route).

## 4) Metrics & Targets (SLO-style)
All targets are **p75** unless otherwise noted; **p95** budget included for tail control.

### 4.1 Public Post pages (`/posts/[slug]`)
- **SRT (server)**: p75 ≤ **150 ms**, p95 ≤ **300 ms** (hot cache); cold cache p75 ≤ 350 ms.
- **TTFB (client)**: p75 ≤ **400 ms**, p95 ≤ **700 ms** (edge + cache).
- **LCP**: p75 ≤ **2.5 s** on 4G; p95 ≤ **3.5 s**.
- **INP**: p75 ≤ **200 ms**.
- **CLS**: p75 ≤ **0.10**.

### 4.2 Admin Dashboard (`/admin/*`)
- **Initial route SRT**: p75 ≤ **200 ms**, p95 ≤ **400 ms**.
- **FCP**: p75 ≤ **1.5 s** (desktop), **2.0 s** (mobile).
- **INP**: p75 ≤ **200 ms** for table interactions and filter changes.
- **CLS**: p75 ≤ **0.10**.
- **Data viewport updates** (filter/sort/paginate): visible update ≤ **300 ms** (p75).

## 5) Measurement Plan

### 5.1 Environments
- **Local/Dev**: engineering iteration only.
- **Staging**: stable dataset snapshot; used for CI Lighthouse runs and load benchmarks.
- **Prod**: RUM (real‑user monitoring) only; no synthetic load.

### 5.2 Tools
- **Synthetic**: Lighthouse CI, WebPageTest (repeat view), k6 or autocannon for server throughput.
- **RUM**: `web-vitals` library + custom endpoint for p75/p95 aggregation.
- **Node/Next.js instrumentation**: `instrumentation.ts` + `performance.mark/measure`, and `Server-Timing` headers.
- **Bundle analysis**: `next build` with `@next/bundle-analyzer`; budget checks in CI.

### 5.3 Methodology
- Test **cold cache** (no CDN/app cache) and **hot cache** (warmed ISR/CDN).
- Profiles:
    - **Mobile throttling**: Simulated Moto G Power / Slow 4G (WPT profile).
    - **Desktop**: 4‑core/4GB throttle in Lighthouse.
- Each benchmark: **5 runs**, discard outliers, report median + p75 + p95.
- Record **commit SHA**, route, dataset size, cache state, tool versions, and environment.

### 5.4 Reporting Artifacts
- `/docs/perf/benchmarks/YYYY‑MM‑DD/*.md` with tables + charts.
- CI comment on PR with deltas vs. main (Lighthouse scores, budgets, size diff).
- Weekly rollup with trend lines for SRT, LCP, bundle sizes.

## 6) Instrumentation Requirements

### 6.1 Server Timing
- Wrap server renders (Route Handlers/Server Components fetches) with `performance.mark/measure`.
- Emit **`Server-Timing: srt;dur=<ms>`** header on Post and Admin routes.
- Log `srt`, cache status (HIT/MISS/STALE), DB timings (see 6.3).

### 6.2 Render-Time Badge (Post pages)
- Display a minimalist badge like: `render: 128ms` (server).
- **Placement**: subtle, top-right near meta line or bottom of article footer.
- **Style**: 12px monospace, 60–80% opacity, rounded, subdued bg, hover shows tooltip: “Server render time.”
- **Behavior**:
    - Reads value from `Server-Timing` or a server‑prop injected field.
    - Hidden for crawlers and in print CSS.
    - Feature-flagged env var: `NEXT_PUBLIC_SHOW_RENDER_BADGE=true`.
    - Sanity check: cap display at `>9999ms` → `>9.9s` to avoid noise.
- **Acceptance**: Badge shows ms on warm pages; disappears if flag is off.

### 6.3 Database & Data Layer
- Add query‑level timings via Drizzle/pg interceptors.
- Log slow queries (≥ **50 ms** single query, ≥ **150 ms** request total DB time).
- Surface **N+1** detection on post load (author, tags, categories, comments count).

### 6.4 RUM Collection
- Capture: LCP, INP, CLS, TTFB, navigation type, device/network rough class.
- Ship minimal payload to `/api/rum` with sampling (default 10%).

## 7) Optimization Areas & Requirements

### 7.1 App Layer (Next.js)
- Prefer **RSC + fetch caching** for post data; enable **ISR** for stable posts; use **On‑Demand Revalidation** on edits.
- Use **`next/image`** with explicit width/height; preconnect to image/CDN domains.
- **Fonts**: self‑host with `next/font`, `display=swap`, minimal weights.
- **JS budgets**:
    - Post page JS ≤ **90 KB** gz (route-level, post without heavy embeds).
    - Admin initial route JS ≤ **180 KB** gz; code‑split charts/tables.
- Avoid blocking scripts; defer or lazy‑load embeds (YouTube, Twitter) behind click‑to‑load.
- **Hydration**: prefer server components; client components only where interactivity is needed.

### 7.2 Admin UI
- **Data grids**: virtualization (e.g., `react-virtual`), server‑side pagination/sorting.
- **Skeletons** for perceived speed; debounce filters (150–250 ms).
- **Batch** network requests per tick; coalesce chatty calls.
- Cache invariant lists (tags/categories) in memory or edge KV with TTL.

### 7.3 Data/DB
- Add indexes for frequent filters (`posts.published_at`, `posts.slug`, join keys).
- Precompute counts (comments, reactions) into materialized views or cached aggregates.
- Avoid **N+1** via joins/selects; return compact DTOs.
- Cap expensive Markdown/MDX processing at build/ISR time; cache rendered HTML.

### 7.4 CDN/Proxy
- Enable **Brotli** + HTTP/2 (or HTTP/3 where supported).
- Set long‑TTL immutable cache for static assets; short‑TTL for JSON/data with revalidation.
- Normalize querystrings; cache HTML for logged‑out traffic by slug; vary on cookies only when needed.

### 7.5 Images & Media
- Generate responsive sizes; lazy‑load below the fold; decode priority for LCP image.
- Strip EXIF; WebP/AVIF where supported.
- Placeholder blur for hero images to improve perceived speed.

## 8) CI & Regression Guardrails
- **Lighthouse CI** on `/` and a representative post slug; fail PR if score delta < −3 or budget exceeded.
- **Bundle budgets**: fail PR if route bundle exceeds target by >10%.
- **k6/autocannon** smoke on staging: 60s @ 50 rps, check p95 SRT ≤ target +20%.
- **Perf snapshots** saved to `/docs/perf/benchmarks` with SHA and numbers.

## 9) Acceptance Criteria

### 9.1 Post Pages
- SRT badge shows valid ms (hot cache) with env flag on.
- p75 TTFB ≤ 400 ms (hot) for top 10 posts over a 7‑day window.
- p75 LCP ≤ 2.5 s on 4G synthetic; RUM confirms p75 ≤ 2.7 s.
- Bundle size and image policies satisfied.

### 9.2 Admin
- First meaningful table view loads with SRT p75 ≤ 200 ms (hot).
- Interactions (filter/sort/paginate) render visible updates ≤ 300 ms p75.
- No CLS jumps > 0.1 during navigation.

## 10) Rollout Plan
1. Implement instrumentation + badge.
2. Add budgets and CI checks.
3. Optimize top offenders (queries, bundles, images).
4. Backfill indexes and materialized views.
5. Re‑benchmark; update SLOs if needed.
6. Enable RUM with 10% sampling; monitor weekly dashboards.

## 11) Security & Privacy
- RUM data is anonymous, sampled, and excludes PII.
- Server logs redact query params with secrets/tokens.

## 12) Appendix — Example Snippets

### 12.1 Server‑Timing in a Route Handler (illustrative)
```ts
// app/posts/[slug]/page.tsx (Server Component)
export default async function PostPage({ params }: { params: { slug: string } }) {
  const t0 = performance.now();
  const post = await getPostBySlug(params.slug); // ensure no N+1 inside
  const html = await renderPostHtml(post);       // cached for ISR
  const t1 = performance.now();
  // attach header via headers() in route handler or middleware
  // responseHeader.set('Server-Timing', `srt;desc="server render";dur=${Math.round(t1 - t0)}`);
  return <Article html={html} meta={post} srtMs={Math.round(t1 - t0)} />;
}
```

### 12.2 Render‑Time Badge (client component)
```tsx
// components/RenderTimeBadge.tsx
"use client";
import { useEffect, useState } from "react";

export function RenderTimeBadge({ serverMs }: { serverMs?: number }) {
  const [ms, setMs] = useState<number | undefined>(serverMs);
  useEffect(() => {
    if (ms == null) {
      // Try to parse Server-Timing from response entries (best‑effort)
      const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      const st = (entry as any).serverTiming?.find?.((x:any)=>x.name==="srt");
      if (st?.duration) setMs(Math.round(st.duration));
    }
  }, [ms]);

  if (!process.env.NEXT_PUBLIC_SHOW_RENDER_BADGE || ms == null) return null;
  const label = ms > 9999 ? ">9.9s" : `${ms}ms`;
  return (
    <div style={{position:"fixed", right:12, bottom:12, fontSize:12, opacity:.7, padding:"4px 8px", borderRadius:8, fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace", background:"var(--badge-bg, rgba(0,0,0,.06))", border:"1px solid rgba(0,0,0,.08)"}} aria-label="Server render time">
      render: {label}
    </div>
  );
}
```

---

**Owner:** Performance WG (Steven)  
**Reviewers:** Frontend, Platform, DBA  
**Versioning:** Changes via PR; update dates & targets as real data improves.
