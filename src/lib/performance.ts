// SPDX-License-Identifier: Apache-2.0
import logger from "@/lib/logger";

export interface PerformanceTiming {
  name: string;
  duration: number;
  description?: string;
}

export interface DatabaseTiming {
  query: string;
  duration: number;
  slow: boolean;
}

export interface RenderMetrics {
  srt: number; // Server Render Time
  dbTime?: number;
  dbQueries?: DatabaseTiming[];
  cacheStatus?: 'HIT' | 'MISS' | 'STALE';
}

/**
 * Creates a Server-Timing header string from performance metrics
 */
export function createServerTimingHeader(metrics: RenderMetrics): string {
  const timings: string[] = [];
  
  // Add Server Render Time (primary metric)
  timings.push(`srt;desc="server render";dur=${metrics.srt}`);
  
  // Add database timing if available
  if (metrics.dbTime !== undefined) {
    timings.push(`db;desc="database";dur=${metrics.dbTime}`);
  }
  
  // Add cache status as a metric
  if (metrics.cacheStatus) {
    timings.push(`cache;desc="${metrics.cacheStatus}"`);
  }
  
  return timings.join(', ');
}

/**
 * Performance measurement wrapper for async operations
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  
  return { result, duration };
}

/**
 * Performance measurement wrapper for sync operations
 */
export function measureSync<T>(
  name: string,
  operation: () => T
): { result: T; duration: number } {
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;
  
  return { result, duration };
}

/**
 * Logs slow queries for monitoring
 */
export function logSlowQuery(
  query: string,
  duration: number,
  threshold: number = 50
): void {
  if (duration >= threshold) {
    logger.warn(`[SLOW QUERY] ${duration.toFixed(1)}ms:`, query.substring(0, 200));
  }
}

/**
 * Creates a performance mark and returns a function to measure
 */
export function createMark(name: string): () => number {
  const markName = `${name}-start`;
  performance.mark(markName);
  
  return () => {
    const endMarkName = `${name}-end`;
    performance.mark(endMarkName);
    
    try {
      performance.measure(name, markName, endMarkName);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      return measure?.duration || 0;
    } catch (error) {
      // Fallback if performance API fails
      logger.warn('Performance measurement failed:', error);
      return 0;
    } finally {
      // Clean up marks to prevent memory leaks
      performance.clearMarks(markName);
      performance.clearMarks(endMarkName);
      performance.clearMeasures(name);
    }
  };
}

/**
 * Database timing interceptor type
 */
export type DatabaseInterceptor = {
  onQueryStart: (query: string) => void;
  onQueryEnd: (query: string, duration: number) => void;
};

/**
 * Creates a database timing interceptor
 */
export function createDatabaseInterceptor(): DatabaseInterceptor {
  const queryStartTimes = new Map<string, number>();
  
  return {
    onQueryStart: (query: string) => {
      const queryId = `${Date.now()}-${Math.random()}`;
      queryStartTimes.set(query, performance.now());
    },
    
    onQueryEnd: (query: string, duration: number) => {
      logSlowQuery(query, duration);
      
      // Log total request DB time if it exceeds threshold
      const totalDbTime = Array.from(queryStartTimes.values())
        .reduce((sum, _) => sum + duration, 0);
      
      if (totalDbTime >= 150) {
        logger.warn(`[HIGH DB TIME] Total request DB time: ${totalDbTime.toFixed(1)}ms`);
      }
    }
  };
}