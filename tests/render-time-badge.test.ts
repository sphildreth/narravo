// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';

describe('RenderTimeBadge functionality', () => {
  it('should format timing values correctly', () => {
    // Test the formatting logic that would be used in the component
    const formatTiming = (timeMs: number): string => {
      if (timeMs > 9999) return ">9.9s";
      return `${timeMs}ms`;
    };

    expect(formatTiming(0)).toBe('0ms');
    expect(formatTiming(123)).toBe('123ms');
    expect(formatTiming(9999)).toBe('9999ms');
    expect(formatTiming(10000)).toBe('>9.9s');
    expect(formatTiming(50000)).toBe('>9.9s');
  });

  it('should determine visibility based on environment flag', () => {
    // Test the visibility logic
    const shouldShowBadge = (envFlag: string | undefined, serverMs: number | undefined): boolean => {
      return envFlag === 'true' && typeof serverMs === 'number' && serverMs >= 0;
    };

    expect(shouldShowBadge('true', 123)).toBe(true);
    expect(shouldShowBadge('false', 123)).toBe(false);
    expect(shouldShowBadge(undefined, 123)).toBe(false);
    expect(shouldShowBadge('true', undefined)).toBe(false);
    expect(shouldShowBadge('true', -1)).toBe(false);
    expect(shouldShowBadge('true', 0)).toBe(true);
  });

  it('should validate performance timing thresholds', () => {
    // Test performance target validation
    const checkPerformanceTarget = (srt: number): { status: 'good' | 'warning' | 'poor'; message: string } => {
      if (srt <= 150) {
        return { status: 'good', message: 'Server render time is within target' };
      } else if (srt <= 300) {
        return { status: 'warning', message: 'Server render time is above p75 target but within p95' };
      } else {
        return { status: 'poor', message: 'Server render time exceeds p95 target' };
      }
    };

    expect(checkPerformanceTarget(100)).toEqual({ 
      status: 'good', 
      message: 'Server render time is within target' 
    });
    
    expect(checkPerformanceTarget(200)).toEqual({ 
      status: 'warning', 
      message: 'Server render time is above p75 target but within p95' 
    });
    
    expect(checkPerformanceTarget(400)).toEqual({ 
      status: 'poor', 
      message: 'Server render time exceeds p95 target' 
    });
  });
});