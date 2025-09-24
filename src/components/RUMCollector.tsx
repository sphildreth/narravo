// SPDX-License-Identifier: Apache-2.0
"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    // Check if RUM collection should be disabled
    if (
      // Respect Do Not Track
      navigator.doNotTrack === '1' ||
      // Skip in preview mode
      window.location.search.includes('preview=') ||
      // Skip if explicitly disabled
      localStorage.getItem('rum-disabled') === 'true'
    ) {
      return;
    }

    // Apply sampling
    const samplingRate = parseFloat(process.env.NEXT_PUBLIC_RUM_SAMPLING_RATE || '0.1');
    if (Math.random() > samplingRate) {
      return;
    }

    // Import web-vitals dynamically to avoid increasing bundle size for all users
    import('web-vitals').then(({ onCLS, onINP, onLCP, onTTFB, onFCP }) => {
      const metrics: WebVitalMetric[] = [];
      let sendTimeout: NodeJS.Timeout;

      const handleMetric = (metric: WebVitalMetric) => {
        metrics.push(metric);
        
        // Debounce sending metrics to batch them
        clearTimeout(sendTimeout);
        sendTimeout = setTimeout(() => {
          sendMetrics([...metrics]);
          metrics.length = 0; // Clear the array
        }, 1000);
      };

      // Collect Core Web Vitals
      onLCP(handleMetric);
      onINP(handleMetric);
      onCLS(handleMetric);
      onTTFB(handleMetric);
      onFCP(handleMetric);

      // Send any remaining metrics when the page is about to unload
      const sendRemainingMetrics = () => {
        if (metrics.length > 0) {
          sendMetrics([...metrics], true);
        }
      };

      window.addEventListener('beforeunload', sendRemainingMetrics);
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          sendRemainingMetrics();
        }
      });

      return () => {
        clearTimeout(sendTimeout);
        window.removeEventListener('beforeunload', sendRemainingMetrics);
        window.removeEventListener('visibilitychange', sendRemainingMetrics);
      };
    }).catch(error => {
      console.warn('Failed to load web-vitals library:', error);
    });
  }, []);

  return null; // This is a data collection component, no UI
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