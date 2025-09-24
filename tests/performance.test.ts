// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { createServerTimingHeader, measureAsync, measureSync } from '@/lib/performance';

describe('Performance utilities', () => {
  it('should create Server-Timing header correctly', () => {
    const metrics = {
      srt: 125.5,
      dbTime: 45.2,
      cacheStatus: 'HIT' as const
    };

    const header = createServerTimingHeader(metrics);
    
    expect(header).toBe('srt;desc="server render";dur=125.5, db;desc="database";dur=45.2, cache;desc="HIT"');
  });

  it('should measure async operations', async () => {
    const operation = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'result';
    };

    const { result, duration } = await measureAsync('test-async', operation);
    
    expect(result).toBe('result');
    expect(duration).toBeGreaterThan(8); // Allow for some timing variance
    expect(duration).toBeLessThan(50);
  });

  it('should measure sync operations', () => {
    const operation = () => {
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    };

    const { result, duration } = measureSync('test-sync', operation);
    
    expect(result).toBe(499500); // Sum of 0 to 999
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(10);
  });

  it('should handle minimal Server-Timing header', () => {
    const metrics = {
      srt: 50
    };

    const header = createServerTimingHeader(metrics);
    
    expect(header).toBe('srt;desc="server render";dur=50');
  });
});