// SPDX-License-Identifier: Apache-2.0
import { execSync } from 'child_process';
/**
 * Performance benchmarking and reporting script
 * Generates performance snapshots and trend analysis
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import logger from "@/lib/logger";

interface BenchmarkResult {
  timestamp: string;
  commitSha: string;
  environment: 'local' | 'staging' | 'production';
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    lcp: number;
    cls: number;
    fcp: number;
  };
  loadTest?: {
    requestsPerSec: number;
    latencyP50: number;
    latencyP95: number;
    errorRate: number;
  };
  bundleSize?: {
    totalSize: number;
    jsSize: number;
    cssSize: number;
    routeSpecificSize?: { [route: string]: number };
  };
}

/**
 * Get current git commit SHA
 */
function getCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Get current git branch
 */
function getBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Run Lighthouse and extract key metrics
 */
async function runLighthouse(): Promise<BenchmarkResult['lighthouse']> {
  try {
    logger.info('🔍 Running Lighthouse...');
    
    // Run lighthouse CI and capture results
    execSync('npx lhci autorun --config=lighthouserc.json', { 
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    // Parse latest lighthouse results
    const resultsDir = './lighthouse-results';
    const files = await fs.readdir(resultsDir).catch(() => []);
    const latestFile = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()[0];
    
    if (!latestFile) {
      throw new Error('No lighthouse results found');
    }
    
    const resultPath = path.join(resultsDir, latestFile);
    const result = JSON.parse(await fs.readFile(resultPath, 'utf-8'));
    
    return {
      performance: Math.round(result.categories.performance.score * 100),
      accessibility: Math.round(result.categories.accessibility.score * 100),
      bestPractices: Math.round(result.categories['best-practices'].score * 100),
      seo: Math.round(result.categories.seo.score * 100),
      lcp: Math.round(result.audits['largest-contentful-paint'].numericValue),
      cls: result.audits['cumulative-layout-shift'].numericValue,
      fcp: Math.round(result.audits['first-contentful-paint'].numericValue),
    };
  } catch (error) {
    console.warn('⚠️ Lighthouse failed:', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

/**
 * Run load test and extract metrics
 */
async function runLoadTest(): Promise<BenchmarkResult['loadTest']> {
  try {
    logger.info('🚛 Running load test...');
    
    const { runLoadTest } = await import('./smoke.autocannon.js');
    const { success, result } = await runLoadTest({
      duration: 30,
      overallRate: 25,
    });
    
    if (!success || !result) {
      throw new Error('Load test failed');
    }
    
    return {
      requestsPerSec: Math.round(result.requests.average),
      latencyP50: (result.latency as any).p50 || result.latency.mean,
      latencyP95: (result.latency as any).p95 || result.latency.max,
      errorRate: result.errors / result.requests.total,
    };
  } catch (error) {
    logger.warn('⚠️ Load test failed:', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

/**
 * Analyze bundle size
 */
async function analyzeBundleSize(): Promise<BenchmarkResult['bundleSize']> {
  try {
    logger.info('📦 Analyzing bundle size...');
    
    // Build with analyzer
    execSync('ANALYZE=true npm run build', { stdio: 'inherit' });
    
    // Parse build output for bundle sizes
    // This is simplified - in practice you'd parse webpack-bundle-analyzer output
    const buildDir = './.next';
    const staticDir = path.join(buildDir, 'static');
    
    let totalSize = 0;
    let jsSize = 0;
    let cssSize = 0;
    
    const calculateDirectorySize = async (dir: string): Promise<number> => {
      let size = 0;
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            size += await calculateDirectorySize(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            size += stats.size;
            
            if (item.name.endsWith('.js')) {
              jsSize += stats.size;
            } else if (item.name.endsWith('.css')) {
              cssSize += stats.size;
            }
          }
        }
      } catch {
        // Ignore errors
      }
      return size;
    };
    
    totalSize = await calculateDirectorySize(staticDir);
    
    return {
      totalSize: Math.round(totalSize / 1024), // KB
      jsSize: Math.round(jsSize / 1024), // KB
      cssSize: Math.round(cssSize / 1024), // KB
    };
  } catch (error) {
    logger.warn('⚠️ Bundle analysis failed:', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

/**
 * Generate performance benchmark report
 */
async function generateBenchmark(environment: 'local' | 'staging' | 'production' = 'local') {
  console.log('🏃‍♂️ Starting performance benchmark...');
  
  const timestamp = new Date().toISOString();
  const commitSha = getCommitSha();
  const branch = getBranch();
  
  console.log(`Environment: ${environment}`);
  console.log(`Commit: ${commitSha}`);
  console.log(`Branch: ${branch}`);
  console.log(`Timestamp: ${timestamp}`);
  
  const benchmark: BenchmarkResult = {
    timestamp,
    commitSha,
    environment,
  };
  
  // Run benchmarks in parallel where possible
  const [lighthouse, loadTest, bundleSize] = await Promise.all([
    runLighthouse(),
    runLoadTest(),
    analyzeBundleSize(),
  ]);
  
  // Save benchmark results
  if (lighthouse) benchmark.lighthouse = lighthouse;
  if (loadTest) benchmark.loadTest = loadTest;
  if (bundleSize) benchmark.bundleSize = bundleSize;
  
  // Save benchmark results
  const dateStr = timestamp.split('T')[0];
  const benchmarkDir = `./docs/perf/benchmarks/${dateStr}`;
  await fs.mkdir(benchmarkDir, { recursive: true });
  
  const benchmarkFile = path.join(benchmarkDir, `${commitSha}.json`);
  await fs.writeFile(benchmarkFile, JSON.stringify(benchmark, null, 2));
  
  // Generate markdown report
  const reportContent = generateMarkdownReport(benchmark);
  const reportFile = path.join(benchmarkDir, `report-${commitSha}.md`);
  await fs.writeFile(reportFile, reportContent);
  
  console.log('✅ Benchmark complete!');
  console.log(`📄 Report saved to: ${reportFile}`);
  console.log(`📊 Data saved to: ${benchmarkFile}`);
  
  // Check if results meet targets
  const issues = validateResults(benchmark);
  if (issues.length > 0) {
    console.log('\n⚠️ Performance Issues Detected:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    process.exit(1);
  }
  
  return benchmark;
}

/**
 * Generate markdown report from benchmark results
 */
function generateMarkdownReport(benchmark: BenchmarkResult): string {
  const { timestamp, commitSha, environment, lighthouse, loadTest, bundleSize } = benchmark;
  
  return `# Performance Benchmark Report

**Environment:** ${environment}  
**Commit:** ${commitSha}  
**Timestamp:** ${timestamp}  

## Lighthouse Scores

${lighthouse ? `
| Metric | Score | Target |
|--------|-------|---------|
| Performance | ${lighthouse.performance}% | ≥80% |
| Accessibility | ${lighthouse.accessibility}% | ≥90% |
| Best Practices | ${lighthouse.bestPractices}% | ≥80% |
| SEO | ${lighthouse.seo}% | ≥90% |

## Core Web Vitals

| Metric | Value | Target |
|--------|--------|---------|
| LCP | ${lighthouse.lcp}ms | ≤2500ms |
| CLS | ${lighthouse.cls} | ≤0.10 |
| FCP | ${lighthouse.fcp}ms | ≤1500ms |
` : '❌ Lighthouse data unavailable'}

## Load Test Results

${loadTest ? `
| Metric | Value | Target |
|--------|--------|---------|
| Requests/sec | ${loadTest.requestsPerSec} | - |
| Latency P50 | ${loadTest.latencyP50}ms | ≤200ms |
| Latency P95 | ${loadTest.latencyP95}ms | ≤400ms |
| Error Rate | ${(loadTest.errorRate * 100).toFixed(2)}% | ≤1% |
` : '❌ Load test data unavailable'}

## Bundle Size Analysis

${bundleSize ? `
| Asset Type | Size | Target |
|------------|------|---------|
| Total | ${bundleSize.totalSize}KB | - |
| JavaScript | ${bundleSize.jsSize}KB | ≤90KB (post pages) |
| CSS | ${bundleSize.cssSize}KB | - |
` : '❌ Bundle analysis unavailable'}

---
Generated by Narravo Performance Monitoring
`;
}

/**
 * Validate results against targets
 */
function validateResults(benchmark: BenchmarkResult): string[] {
  const issues: string[] = [];
  
  if (benchmark.lighthouse) {
    const { performance, lcp, cls } = benchmark.lighthouse;
    if (performance < 80) issues.push(`Lighthouse Performance: ${performance}% < 80%`);
    if (lcp > 2500) issues.push(`LCP: ${lcp}ms > 2500ms`);
    if (cls > 0.10) issues.push(`CLS: ${cls} > 0.10`);
  }
  
  if (benchmark.loadTest) {
    const { latencyP95, errorRate } = benchmark.loadTest;
    if (latencyP95 > 400) issues.push(`P95 Latency: ${latencyP95}ms > 400ms`);
    if (errorRate > 0.01) issues.push(`Error Rate: ${(errorRate * 100).toFixed(2)}% > 1%`);
  }
  
  if (benchmark.bundleSize) {
    const { jsSize } = benchmark.bundleSize;
    if (jsSize > 90) issues.push(`JS Bundle Size: ${jsSize}KB > 90KB`);
  }
  
  return issues;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const environment = (process.argv[2] as any) || 'local';
  generateBenchmark(environment).catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

export { generateBenchmark };
export type { BenchmarkResult };