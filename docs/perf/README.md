# Performance Monitoring Documentation

This directory contains performance benchmarking and monitoring tools for Narravo.

## Overview

The performance monitoring system provides:

- **Server-side instrumentation** with Server-Timing headers
- **Real User Monitoring (RUM)** with Core Web Vitals collection
- **Render-time badges** for development/debugging
- **Automated benchmarking** with Lighthouse and load testing
- **Bundle size monitoring** and budget enforcement
- **CI/CD integration** for performance regression detection

## Quick Start

### Enable Render Time Badge

Set the configuration setting `VIEW.PUBLIC-SHOW-RENDER-BADGE` to `true` in the admin settings.

### Run Performance Benchmarks

```bash
# Full benchmark suite
npm run perf:benchmark

# Individual tools
npm run perf:lighthouse  # Lighthouse CI
npm run perf:loadtest    # Load testing
npm run perf:bundle      # Bundle analysis
```

### View Performance Data

- Real-time metrics: Check browser DevTools → Network → Response Headers for `Server-Timing`
- Benchmark reports: `./docs/perf/benchmarks/YYYY-MM-DD/`
- Bundle analyzer: `ANALYZE=true npm run build`

## Components

### 1. Server-Side Instrumentation

#### Server-Timing Headers

All post and admin pages include Server-Timing headers:

```
Server-Timing: srt;desc="server render";dur=123.45
Server-Timing: db;desc="database";dur=45.67
Server-Timing: cache;desc="HIT"
```

#### Database Query Monitoring

Automatic logging of slow queries (≥50ms) and high total DB time (≥150ms per request).

#### Performance Utilities

```typescript
import { measureAsync, createServerTimingHeader } from '@/lib/performance';

const { result, duration } = await measureAsync('operation-name', async () => {
  return await someAsyncOperation();
});
```

### 2. Render Time Badge

Shows server render time on post pages when enabled:

- **Configuration**: `VIEW.PUBLIC-SHOW-RENDER-BADGE` (boolean)
- **Position**: Fixed bottom-right corner
- **Styling**: Subtle, non-intrusive, hidden for print/crawlers
- **Data source**: Server-provided timing or Server-Timing header

### 3. Real User Monitoring (RUM)

Collects Core Web Vitals from real users:

```typescript
import { RUMCollector } from '@/components/RUMCollector';

// Add to layout or key pages
<RUMCollector />
```

**Features:**
- 10% sampling rate (configurable via `NEXT_PUBLIC_RUM_SAMPLING_RATE`)
- Respects Do Not Track headers
- Anonymous data collection (no PII)
- Automatic batching and beacon sending
- Collects: LCP, INP, CLS, TTFB, FCP

**Data endpoint**: `POST /api/rum`

### 4. Automated Benchmarking

#### Lighthouse CI

Configuration: `lighthouserc.json`

**Targets:**
- Performance: ≥80%
- LCP: ≤2500ms
- CLS: ≤0.10
- Accessibility: ≥90%

#### Load Testing

Tool: Autocannon  
Configuration: `scripts/perf/smoke.autocannon.ts`

**Targets:**
- P95 Latency: ≤400ms
- Error Rate: ≤1%

#### Bundle Analysis

Tool: @next/bundle-analyzer  
Enable: `ANALYZE=true npm run build`

**Targets:**
- Post page JS: ≤90KB gzipped
- Admin initial JS: ≤180KB gzipped

### 5. CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/performance.yml
- name: Performance Check
  run: |
    npm run build
    npm run perf:benchmark
    # Fails CI if targets not met
```

## Environment Variables

### Client-Side

- `NEXT_PUBLIC_RUM_SAMPLING_RATE`: RUM sampling rate (`0.0`-`1.0`, default: `0.1`)

### Server-Side

- `RUM_SAMPLING_RATE`: Server-side RUM sampling (`0.0`-`1.0`, default: `0.1`)
- `PERF_LOG_SLOW_QUERIES`: Enable slow query logging (`true`/`false`, default: `true`)

## Performance Targets (SLOs)

### Post Pages (`/posts/[slug]`)

- **Server Render Time**: p75 ≤ 150ms, p95 ≤ 300ms (hot cache)
- **TTFB**: p75 ≤ 400ms, p95 ≤ 700ms
- **LCP**: p75 ≤ 2.5s (4G), p95 ≤ 3.5s
- **INP**: p75 ≤ 200ms
- **CLS**: p75 ≤ 0.10

### Admin Pages (`/admin/*`)

- **First Route SRT**: p75 ≤ 200ms, p95 ≤ 400ms
- **FCP**: p75 ≤ 1.5s (desktop), 2.0s (mobile)
- **Interaction Response**: p75 ≤ 300ms
- **CLS**: p75 ≤ 0.10

### Bundle Size Budgets

- **Post Pages**: ≤90KB gzipped JS
- **Admin Initial**: ≤180KB gzipped JS
- **Admin Code-Split**: Lazy-loaded features

## Monitoring and Alerting

### Real-Time Monitoring

1. **Server-Timing headers** in browser DevTools
2. **Console logs** for slow queries and high DB time
3. **Render time badge** for visual feedback

### Historical Analysis

1. **Benchmark reports** in `/docs/perf/benchmarks/`
2. **Trend analysis** via weekly rollup scripts
3. **Git commit correlation** for performance regressions

### CI/CD Gates

1. **Lighthouse score deltas** (fail if >3 point drop)
2. **Bundle size budgets** (fail if >10% increase)
3. **Load test SLOs** (fail if P95 latency >target +20%)

## Troubleshooting

### Common Issues

**Badge not showing:**
- Check `VIEW.PUBLIC-SHOW-RENDER-BADGE` is `true` in admin settings.
- Verify not in crawler/bot user agent
- Check browser console for errors

**Slow Server-Timing:**
- Review database queries in logs
- Check for N+1 query patterns
- Verify proper indexes exist

**High RUM values:**
- Check Core Web Vitals in real browsers
- Compare with synthetic Lighthouse results
- Verify image optimization and lazy loading

**Failed CI benchmarks:**
- Check lighthouse-results/ directory
- Review bundle analyzer output
- Verify staging environment stability

### Debug Commands

```bash
# Verbose lighthouse run
npx lhci autorun --config=lighthouserc.json --verbose

# Bundle analysis with details
ANALYZE=true npm run build

# Load test with custom params
node scripts/perf/smoke.autocannon.ts --duration 30 --connections 5

# Manual benchmark
node scripts/perf/report.ts staging
```

## Future Enhancements

- [ ] Integration with monitoring services (DataDog, New Relic)
- [ ] Custom performance dashboards
- [ ] Automated performance regression detection
- [ ] A/B testing framework integration
- [ ] Mobile-specific performance tracking
- [ ] Edge function performance monitoring

## Contributing

When adding new performance instrumentation:

1. **Measure meaningful operations** (>10ms impact)
2. **Use consistent naming** for Server-Timing entries
3. **Add proper error handling** for measurement failures
4. **Update benchmark targets** when making significant changes
5. **Document new metrics** in this README

---

For detailed implementation requirements, see `docs/REQ_PERFORMANCE.md`.