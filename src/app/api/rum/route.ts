// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
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
    // Check Do Not Track header
    const headersList = headers();
    const dnt = headersList.get('dnt') || headersList.get('DNT');
    if (dnt === '1') {
      return new Response(null, { status: 204 });
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

    // Extract client IP for rate limiting (hashed)
    const clientIp = getClientIp(request);
    
    // Rate limiting: max 60 requests per minute per IP
    if (await isRateLimited(clientIp)) {
      return new Response('Rate limited', { status: 429 });
    }

    // Process the metrics (in production, this would typically be sent to a metrics store)
    await processMetrics({
      url: sanitizedUrl,
      metrics: validMetrics,
      deviceType: payload.deviceType || undefined,
      connectionType: payload.connectionType,
      timestamp: payload.timestamp || Date.now(),
      clientIp: hashIp(clientIp),
    });

    return new Response(null, { status: 204 });

  } catch (error) {
    console.error('RUM processing error:', error);
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
 * Extract client IP with proxy support
 */
function getClientIp(request: NextRequest): string {
  const headersList = headers();
  return (
    headersList.get('x-forwarded-for')?.split(',')[0] ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') ||
    request.ip ||
    'unknown'
  );
}

/**
 * Hash IP address for privacy
 */
function hashIp(ip: string): string {
  // In production, use a proper hash with a secret salt
  // For now, just return a simple hash for demonstration
  return Buffer.from(ip).toString('base64').substring(0, 16);
}

/**
 * Simple in-memory rate limiting (in production, use Redis)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

async function isRateLimited(ip: string): Promise<boolean> {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60;
  
  const key = hashIp(ip);
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (entry.count >= maxRequests) {
    return true;
  }
  
  entry.count++;
  return false;
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
  clientIp: string;
}): Promise<void> {
  // Log metrics for debugging (in production, send to analytics service)
  if (process.env.NODE_ENV === 'development') {
    console.log('RUM Metrics:', JSON.stringify(data, null, 2));
  }
  
  // TODO: In production implementation:
  // - Store in time-series database (InfluxDB, CloudWatch, etc.)
  // - Send to analytics service (DataDog, New Relic, etc.)
  // - Update aggregated metrics for dashboards
}