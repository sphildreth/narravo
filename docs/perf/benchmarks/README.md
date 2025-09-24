# Performance Benchmarks

This directory contains historical performance benchmarks organized by date.

## Structure

```
benchmarks/
├── 2024-12-19/
│   ├── abc123.json      # Raw benchmark data
│   ├── report-abc123.md # Human-readable report
│   └── ...
└── README.md
```

## Benchmark Data Format

Each benchmark JSON file contains:

```json
{
  "timestamp": "2024-12-19T15:30:00.000Z",
  "commitSha": "abc123",
  "environment": "staging",
  "lighthouse": {
    "performance": 95,
    "accessibility": 98,
    "bestPractices": 92,
    "seo": 100,
    "lcp": 1200,
    "cls": 0.05,
    "fcp": 800
  },
  "loadTest": {
    "requestsPerSec": 150,
    "latencyP50": 120,
    "latencyP95": 280,
    "errorRate": 0.002
  },
  "bundleSize": {
    "totalSize": 245,
    "jsSize": 78,
    "cssSize": 12
  }
}
```

## Running Benchmarks

```bash
# Full benchmark
npm run perf:benchmark

# Specific environment
node scripts/perf/report.ts staging

# Compare with previous
node scripts/perf/compare.ts HEAD~1
```

## Targets and Alerts

The benchmark system will flag issues when metrics exceed targets:

- **Lighthouse Performance**: <80%
- **LCP**: >2500ms
- **CLS**: >0.10
- **P95 Latency**: >400ms
- **Error Rate**: >1%
- **JS Bundle**: >90KB (post pages)

## Weekly Reports

Automated weekly rollup reports are generated showing trends:

- Performance score changes
- Bundle size growth
- Latency percentile trends
- Regression detection

See `scripts/perf/weekly-rollup.ts` for implementation.

## Integration

Benchmarks are automatically run:

1. **CI/CD pipeline**: On pull requests and main branch pushes
2. **Staging deploys**: After each deployment
3. **Scheduled**: Daily at 6 AM UTC
4. **Manual**: Via npm scripts or direct script execution

## Analyzing Results

### Single Benchmark

Each report includes:
- Current vs. target comparison
- Pass/fail status for each metric
- Historical context (when available)

### Trend Analysis

Use the weekly rollup to identify:
- Performance regressions over time
- Bundle size growth patterns
- Latency degradation trends
- Seasonal traffic impacts

### Correlation with Deploys

Benchmark timestamps can be correlated with:
- Git commit history
- Deployment logs  
- Feature releases
- Infrastructure changes

This helps identify root causes of performance changes.