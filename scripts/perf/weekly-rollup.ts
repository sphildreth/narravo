// SPDX-License-Identifier: Apache-2.0
/**
 * Weekly performance rollup script
 * Generates trend analysis from benchmark data
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { BenchmarkResult } from './report.js';

interface WeeklyTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
}

interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  benchmarkCount: number;
  trends: WeeklyTrend[];
  highlights: string[];
  recommendations: string[];
}

/**
 * Generate weekly performance rollup report
 */
async function generateWeeklyRollup(): Promise<WeeklyReport> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Collect benchmark data from the last two weeks
  const currentWeekData = await collectBenchmarkData(oneWeekAgo, now);
  const previousWeekData = await collectBenchmarkData(twoWeeksAgo, oneWeekAgo);

  const trends = analyzeTrends(currentWeekData, previousWeekData);
  const highlights = generateHighlights(trends);
  const recommendations = generateRecommendations(trends);

  return {
    weekStart: oneWeekAgo.toISOString().split('T')[0],
    weekEnd: now.toISOString().split('T')[0],
    benchmarkCount: currentWeekData.length,
    trends,
    highlights,
    recommendations,
  };
}

/**
 * Collect benchmark data for a date range
 */
async function collectBenchmarkData(startDate: Date, endDate: Date): Promise<BenchmarkResult[]> {
  const benchmarks: BenchmarkResult[] = [];
  const baseDir = './docs/perf/benchmarks';

  try {
    const days = await fs.readdir(baseDir);
    
    for (const day of days) {
      if (day === 'README.md') continue;
      
      const dayDate = new Date(day);
      if (dayDate >= startDate && dayDate <= endDate) {
        const dayDir = path.join(baseDir, day);
        const files = await fs.readdir(dayDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(dayDir, file);
              const data = await fs.readFile(filePath, 'utf-8');
              const benchmark: BenchmarkResult = JSON.parse(data);
              benchmarks.push(benchmark);
            } catch (error) {
              console.warn(`Failed to parse benchmark file ${file}:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('No benchmark data found:', error);
  }

  return benchmarks.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Analyze performance trends between two time periods
 */
function analyzeTrends(current: BenchmarkResult[], previous: BenchmarkResult[]): WeeklyTrend[] {
  if (current.length === 0 && previous.length === 0) {
    return [];
  }

  const trends: WeeklyTrend[] = [];
  
  // Lighthouse Performance Score
  const currentLH = getAverageMetric(current, 'lighthouse.performance');
  const previousLH = getAverageMetric(previous, 'lighthouse.performance');
  if (currentLH !== null && previousLH !== null) {
    trends.push(createTrend('Lighthouse Performance', currentLH, previousLH));
  }

  // LCP (Largest Contentful Paint)
  const currentLCP = getAverageMetric(current, 'lighthouse.lcp');
  const previousLCP = getAverageMetric(previous, 'lighthouse.lcp');
  if (currentLCP !== null && previousLCP !== null) {
    trends.push(createTrend('LCP', currentLCP, previousLCP, true)); // Lower is better
  }

  // P95 Latency
  const currentP95 = getAverageMetric(current, 'loadTest.latencyP95');
  const previousP95 = getAverageMetric(previous, 'loadTest.latencyP95');
  if (currentP95 !== null && previousP95 !== null) {
    trends.push(createTrend('P95 Latency', currentP95, previousP95, true)); // Lower is better
  }

  // Bundle Size
  const currentJS = getAverageMetric(current, 'bundleSize.jsSize');
  const previousJS = getAverageMetric(previous, 'bundleSize.jsSize');
  if (currentJS !== null && previousJS !== null) {
    trends.push(createTrend('JS Bundle Size', currentJS, previousJS, true)); // Lower is better
  }

  return trends;
}

/**
 * Get average value for a nested metric path
 */
function getAverageMetric(data: BenchmarkResult[], path: string): number | null {
  const values = data
    .map(item => getNestedValue(item, path))
    .filter(val => typeof val === 'number') as number[];
  
  return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : null;
}

/**
 * Get nested object value by dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Create trend analysis object
 */
function createTrend(
  metric: string, 
  current: number, 
  previous: number, 
  lowerIsBetter = false
): WeeklyTrend {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  
  let trend: 'improving' | 'degrading' | 'stable';
  const threshold = 2; // 2% threshold for stability
  
  if (Math.abs(changePercent) < threshold) {
    trend = 'stable';
  } else if (lowerIsBetter) {
    trend = change < 0 ? 'improving' : 'degrading';
  } else {
    trend = change > 0 ? 'improving' : 'degrading';
  }

  return {
    metric,
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    trend,
  };
}

/**
 * Generate highlights from trend data
 */
function generateHighlights(trends: WeeklyTrend[]): string[] {
  const highlights: string[] = [];
  
  const improving = trends.filter(t => t.trend === 'improving');
  const degrading = trends.filter(t => t.trend === 'degrading');
  
  if (improving.length > 0) {
    highlights.push(`✅ **Improved**: ${improving.map(t => t.metric).join(', ')}`);
  }
  
  if (degrading.length > 0) {
    highlights.push(`⚠️ **Degraded**: ${degrading.map(t => t.metric).join(', ')}`);
  }
  
  // Find the biggest improvements and regressions
  const sortedByChange = [...trends].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  const biggestChange = sortedByChange[0];
  
  if (biggestChange && Math.abs(biggestChange.changePercent) > 5) {
    const direction = biggestChange.trend === 'improving' ? 'improved' : 'degraded';
    highlights.push(`📊 **Biggest Change**: ${biggestChange.metric} ${direction} by ${Math.abs(biggestChange.changePercent).toFixed(1)}%`);
  }

  return highlights;
}

/**
 * Generate recommendations based on trends
 */
function generateRecommendations(trends: WeeklyTrend[]): string[] {
  const recommendations: string[] = [];
  
  // Check for concerning trends
  const lcp = trends.find(t => t.metric === 'LCP');
  if (lcp && lcp.current > 2500) {
    recommendations.push('🎯 **LCP Optimization**: Consider image optimization, font loading, and critical resource prioritization');
  }
  
  const p95 = trends.find(t => t.metric === 'P95 Latency');
  if (p95 && p95.current > 400) {
    recommendations.push('🚀 **Server Performance**: Review database queries, caching strategy, and server resources');
  }
  
  const bundle = trends.find(t => t.metric === 'JS Bundle Size');
  if (bundle && bundle.current > 90) {
    recommendations.push('📦 **Bundle Size**: Implement code splitting, tree shaking, and remove unused dependencies');
  }
  
  const performance = trends.find(t => t.metric === 'Lighthouse Performance');
  if (performance && performance.current < 80) {
    recommendations.push('💡 **General Performance**: Run detailed Lighthouse audit for specific recommendations');
  }

  if (recommendations.length === 0) {
    recommendations.push('✨ **Great job!** All performance metrics are within targets');
  }

  return recommendations;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: WeeklyReport): string {
  const { weekStart, weekEnd, benchmarkCount, trends, highlights, recommendations } = report;
  
  return `# Weekly Performance Report

**Period**: ${weekStart} to ${weekEnd}  
**Benchmarks**: ${benchmarkCount} data points  
**Generated**: ${new Date().toISOString().split('T')[0]}

## Highlights

${highlights.map(h => `- ${h}`).join('\n')}

## Trend Analysis

| Metric | Current | Previous | Change | Trend |
|--------|---------|-----------|---------|-------|
${trends.map(t => {
  const arrow = t.trend === 'improving' ? '📈' : t.trend === 'degrading' ? '📉' : '➡️';
  const changeStr = t.change > 0 ? `+${t.change}` : `${t.change}`;
  return `| ${t.metric} | ${t.current} | ${t.previous} | ${changeStr} (${t.changePercent > 0 ? '+' : ''}${t.changePercent}%) | ${arrow} |`;
}).join('\n')}

## Recommendations

${recommendations.map(r => `- ${r}`).join('\n')}

## Targets Reminder

- **Lighthouse Performance**: ≥80%
- **LCP**: ≤2500ms  
- **P95 Latency**: ≤400ms
- **JS Bundle Size**: ≤90KB (post pages)

---
*Automated report generated by Narravo Performance Monitoring*
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('📊 Generating weekly performance rollup...');
  
  try {
    const report = await generateWeeklyRollup();
    const markdown = generateMarkdownReport(report);
    
    // Save report
    const reportDir = './docs/perf/weekly';
    await fs.mkdir(reportDir, { recursive: true });
    
    const filename = `weekly-${report.weekEnd}.md`;
    const filepath = path.join(reportDir, filename);
    await fs.writeFile(filepath, markdown);
    
    console.log(`✅ Weekly report generated: ${filepath}`);
    
    // Output summary to console
    console.log('\n' + markdown);
    
  } catch (error) {
    console.error('❌ Failed to generate weekly report:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateWeeklyRollup, WeeklyReport };