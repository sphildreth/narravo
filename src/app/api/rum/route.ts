// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import logger from '@/lib/logger';
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";

const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RUMMetric {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
}

interface RUMPayload {
  url: string;
  metrics: RUMMetric[];
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  connectionType?: string;
  timestamp: number;
}

/**
 * Real User Monitoring (RUM) endpoint
 * Collects Core Web Vitals and performance metrics from real users
 * Features:
 * - 10% sampling by default
 * - Anonymous data collection (no PII)
 * - Validates input data
 * - Respects DNT headers
 */
export async function POST(request: NextRequest) {
  try {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      return new Response(null, { status: 204 });
    }

    // Check Do Not Track header
    const dnt = request.headers.get('dnt');
    if (dnt === '1') {
      return new Response(null, { status: 204 });
    }

    // A shared global budget avoids per-process bypasses and eliminates the
    // attacker-controlled, spoofable IP-key map previously used here.
    const rateLimit = await consumeSharedRateLimit("rum:global", 600, 60 * 1000);
    if (rateLimit.limited) {
      return new Response('Rate limited', { status: 429 });
    }

    // Apply sampling - only process 10% of requests by default
    const samplingRate = parseFloat(process.env.RUM_SAMPLING_RATE || '0.1');
    if (Math.random() > samplingRate) {
      return new Response(null, { status: 204 });
    }

    const payload: RUMPayload = await request.json();
    
    // Validate required fields
    if (!payload.url || !payload.metrics || !Array.isArray(payload.metrics)) {
      return new Response('Invalid payload', { status: 400 });
    }

    // Sanitize URL to remove query parameters and personal info
    const sanitizedUrl = sanitizeUrl(payload.url);
    if (!sanitizedUrl) {
      return new Response('Invalid URL', { status: 400 });
    }

    // Validate metrics
    const validMetrics = payload.metrics.filter(isValidMetric);
    if (validMetrics.length === 0) {
      return new Response('No valid metrics', { status: 400 });
    }

    // Process the metrics (in production, this would typically be sent to a metrics store)
    await processMetrics({
      url: sanitizedUrl,
      metrics: validMetrics,
      deviceType: payload.deviceType || undefined,
      connectionType: payload.connectionType,
      timestamp: payload.timestamp || Date.now(),
    });

    return new Response(null, { status: 204 });

  } catch (error) {
    logger.error('RUM processing error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

/**
 * Sanitize URL to remove PII and query parameters
 */
function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only keep host and pathname, remove query params and fragments
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return null;
  }
}

/**
 * Validate individual metric
 */
function isValidMetric(metric: any): metric is RUMMetric {
  return (
    metric &&
    typeof metric.name === 'string' &&
    typeof metric.value === 'number' &&
    metric.value >= 0 &&
    metric.value < 60000 && // Cap at 60 seconds to filter out invalid values
    // Accept common Core Web Vitals; include FID for older browsers
    ['LCP', 'INP', 'CLS', 'TTFB', 'FCP', 'FID'].includes(metric.name)
  );
}

/**
 * Process metrics (store or forward to analytics service)
 */
async function processMetrics(data: {
  url: string;
  metrics: RUMMetric[];
  deviceType?: string | undefined;
  connectionType?: string | undefined;
  timestamp: number;
}): Promise<void> {
  // Log metrics for debugging (in production, send to analytics service)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('RUM Metrics:', JSON.stringify(data, null, 2));
  }
  
  // TODO: In production implementation:
  // - Store in time-series database (InfluxDB, CloudWatch, etc.)
  // - Send to analytics service (DataDog, New Relic, etc.)
  // - Update aggregated metrics for dashboards
}
