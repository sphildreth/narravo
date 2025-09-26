// SPDX-License-Identifier: Apache-2.0
"use client";

import { useReportWebVitals } from 'next/web-vitals';
import { useEffect, useRef } from 'react';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

/**
 * RUM (Real User Monitoring) collector component
 * Collects Core Web Vitals and sends to /api/rum
 * Features:
 * - Automatic metric collection using web-vitals library
 * - 10% sampling by default
 * - Respects DNT and user preferences
 * - Batches metrics for efficiency
 */
export function RUMCollector() {
  const metrics = useRef<WebVitalMetric[]>([]);
  const sendTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleMetric = (metric: WebVitalMetric) => {
    metrics.current.push(metric);
    
    // Debounce sending metrics to batch them
    if (sendTimeout.current) {
      clearTimeout(sendTimeout.current);
    }
    sendTimeout.current = setTimeout(() => {
      if (metrics.current.length > 0) {
        sendMetrics([...metrics.current]);
        metrics.current = []; // Clear the array
      }
    }, 1000);
  };

  useReportWebVitals((metric) => {
    // Check if RUM collection should be disabled
    if (
      navigator.doNotTrack === '1' ||
      window.location.search.includes('preview=') ||
      localStorage.getItem('rum-disabled') === 'true'
    ) {
      return;
    }

    // Apply sampling
    const samplingRate = parseFloat(process.env.NEXT_PUBLIC_RUM_SAMPLING_RATE || '0.1');
    if (Math.random() > samplingRate) {
      return;
    }

    handleMetric(metric);
  });

  useEffect(() => {
    const sendRemainingMetrics = () => {
      if (metrics.current.length > 0) {
        sendMetrics([...metrics.current], true);
        metrics.current = [];
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendRemainingMetrics();
      }
    };

    window.addEventListener('beforeunload', sendRemainingMetrics);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (sendTimeout.current) {
        clearTimeout(sendTimeout.current);
      }
      window.removeEventListener('beforeunload', sendRemainingMetrics);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      sendRemainingMetrics(); // Final send on unmount
    };
  }, []);

  return null;
}

/**
 * Send metrics to RUM endpoint
 */
function sendMetrics(metrics: WebVitalMetric[], useBeacon = false) {
  if (metrics.length === 0) return;

  const payload = {
    url: window.location.href,
    metrics: metrics.map(metric => ({
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
      id: metric.id,
    })),
    deviceType: getDeviceType(),
    connectionType: getConnectionType(),
    timestamp: Date.now(),
  };

  // Use sendBeacon for reliability on page unload, fallback to fetch
  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json',
    });
    navigator.sendBeacon('/api/rum', blob);
  } else {
    // Use fetch with keepalive for reliability
    fetch('/api/rum', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(error => {
      // Silently handle errors to avoid noise in user experience
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to send RUM metrics:', error);
      }
    });
  }
}

/**
 * Detect device type from user agent and screen size
 */
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
  const isTablet = /tablet|ipad/.test(ua) || (window.screen.width >= 768 && window.screen.width <= 1024);
  
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

/**
 * Get connection type if available
 */
function getConnectionType(): string | undefined {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  return connection?.effectiveType || connection?.type;
}