import { ConfigServiceImpl } from "./config";
import { db } from "./db";

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number, // seconds until next attempt allowed
    public limit: number, // requests per window
    public window: number // window size in seconds
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface RateLimitCheck {
  allowed: boolean;
  retryAfter: number | undefined; // seconds until next attempt allowed
  limit: number;
  remaining: number;
  resetTime: number; // timestamp when window resets
}

/**
 * Simple in-memory rate limiter using sliding window.
 * For MVP purposes only - in production would use Redis/external store.
 */
class InMemoryRateLimiter {
  private store = new Map<string, Array<{ timestamp: number }>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entries] of this.store.entries()) {
      // Remove entries older than 1 hour (max practical window)
      const filtered = entries.filter(entry => now - entry.timestamp < 60 * 60 * 1000);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else if (filtered.length !== entries.length) {
        this.store.set(key, filtered);
      }
    }
  }

  checkLimit(key: string, limit: number, windowMs: number): RateLimitCheck {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or initialize entries for this key
    const entries = this.store.get(key) || [];
    
    // Filter to only entries within the current window
    const validEntries = entries.filter(entry => entry.timestamp > windowStart);
    
    const remaining = Math.max(0, limit - validEntries.length);
    const allowed = validEntries.length < limit;
    
    let retryAfter = 0;
    if (!allowed && validEntries.length > 0) {
      // Calculate when the oldest entry in the window will expire
      const oldestEntry = validEntries[0];
      if (oldestEntry) {
        retryAfter = Math.ceil((oldestEntry.timestamp + windowMs - now) / 1000);
      }
    }
    
    return {
      allowed,
      retryAfter: allowed ? undefined : retryAfter,
      limit,
      remaining,
      resetTime: now + windowMs
    };
  }

  recordRequest(key: string, limit: number, windowMs: number): RateLimitCheck {
    const now = Date.now();
    const check = this.checkLimit(key, limit, windowMs);
    
    if (check.allowed) {
      const entries = this.store.get(key) || [];
      entries.push({ timestamp: now });
      
      // Keep only entries within the window and limit to prevent memory bloat
      const windowStart = now - windowMs;
      const validEntries = entries
        .filter(entry => entry.timestamp > windowStart)
        .slice(-limit); // Keep at most 'limit' entries
      
      this.store.set(key, validEntries);
      
      return {
        ...check,
        remaining: Math.max(0, check.remaining - 1)
      };
    }
    
    return check;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Global instance for the application
const limiter = new InMemoryRateLimiter();

// Clean up on process exit
process.on('SIGTERM', () => limiter.destroy());
process.on('SIGINT', () => limiter.destroy());

export interface RateLimitOptions {
  userId: string;
  ip?: string;
  action: 'comment' | 'reaction';
  headers?: Headers | undefined; // for extracting IP from headers if needed
}

/**
 * Check if the request is within rate limits
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitCheck> {
  const config = new ConfigServiceImpl({ db });
  
  // Get the appropriate limit based on action
  const configKey = options.action === 'comment' 
    ? 'RATE.COMMENTS-PER-MINUTE' 
    : 'RATE.REACTIONS-PER-MINUTE';
  
  const limit = await config.getNumber(configKey);
  if (limit == null) {
    throw new Error(`Missing required config: ${configKey}`);
  }
  
  const windowMs = 60 * 1000; // 1 minute in milliseconds
  
  // Create rate limit key combining user and IP (if available)
  // This prevents both per-user and per-IP abuse
  const ip = options.ip || extractIpFromHeaders(options.headers) || 'unknown';
  const key = `${options.action}:${options.userId}:${ip}`;
  
  return limiter.checkLimit(key, limit, windowMs);
}

/**
 * Record a request and check if it's allowed
 */
export async function recordAndCheckRateLimit(options: RateLimitOptions): Promise<RateLimitCheck> {
  const config = new ConfigServiceImpl({ db });
  
  // Get the appropriate limit based on action
  const configKey = options.action === 'comment' 
    ? 'RATE.COMMENTS-PER-MINUTE' 
    : 'RATE.REACTIONS-PER-MINUTE';
  
  const limit = await config.getNumber(configKey);
  if (limit == null) {
    throw new Error(`Missing required config: ${configKey}`);
  }
  
  const windowMs = 60 * 1000; // 1 minute in milliseconds
  
  // Create rate limit key combining user and IP (if available)
  const ip = options.ip || extractIpFromHeaders(options.headers) || 'unknown';
  const key = `${options.action}:${options.userId}:${ip}`;
  
  return limiter.recordRequest(key, limit, windowMs);
}

/**
 * Extract IP address from request headers
 */
function extractIpFromHeaders(headers?: Headers): string | null {
  if (!headers) return null;
  
  // Check common headers for real IP (accounting for proxies)
  const possibleHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'true-client-ip',
    'x-cluster-client-ip'
  ];
  
  for (const header of possibleHeaders) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0]?.trim();
      if (ip && isValidIp(ip)) {
        return ip;
      }
    }
  }
  
  return null;
}

/**
 * Basic IP validation
 */
function isValidIp(ip: string): boolean {
  // IPv4 validation with proper range checking
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ip.match(ipv4Regex);
  
  if (ipv4Match) {
    // Check each octet is between 0-255
    for (let i = 1; i <= 4; i++) {
      const octetStr = ipv4Match[i];
      if (!octetStr) return false;
      const octet = parseInt(octetStr, 10);
      if (octet < 0 || octet > 255) {
        return false;
      }
    }
    return true;
  }
  
  // IPv6 validation (simplified - full validation is complex)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * Validate honeypot field (should be empty)
 */
export function validateHoneypot(honeypotValue: string | null | undefined): boolean {
  // Honeypot field should always be empty for legitimate users
  return !honeypotValue || honeypotValue.trim() === '';
}

/**
 * Validate minimum submit time
 */
export async function validateMinSubmitTime(
  submitStartTime: number | null | undefined
): Promise<{ valid: boolean; actualTime?: number; requiredTime?: number }> {
  const config = new ConfigServiceImpl({ db });
  let minSubmitSecs = await config.getNumber('RATE.MIN-SUBMIT-SECS');

  // Fallback to a sensible default if not configured or invalid
  if (typeof minSubmitSecs !== 'number' || !Number.isFinite(minSubmitSecs) || minSubmitSecs <= 0) {
    minSubmitSecs = 2; // default minimum submit time in seconds
  }

  // If the submitStartTime is missing/invalid, still return the requiredTime for messaging
  if (typeof submitStartTime !== 'number' || !Number.isFinite(submitStartTime) || submitStartTime <= 0) {
    return { valid: false, requiredTime: minSubmitSecs };
  }
  
  const now = Date.now();
  const actualTime = (now - submitStartTime) / 1000; // Convert to seconds
  
  return {
    valid: actualTime >= minSubmitSecs,
    actualTime,
    requiredTime: minSubmitSecs
  };
}

/**
 * Combined anti-abuse validation
 */
export interface AntiAbuseValidation {
  honeypot?: string | null;
  submitStartTime?: number | null;
  headers?: Headers;
}

export async function validateAntiAbuse(
  userId: string,
  action: 'comment' | 'reaction',
  validation: AntiAbuseValidation
): Promise<{
  valid: boolean;
  error?: string;
  rateLimitInfo?: RateLimitCheck;
}> {
  try {
    // 1. Validate honeypot
    if (!validateHoneypot(validation.honeypot)) {
      return {
        valid: false,
        error: 'Invalid form submission'
      };
    }
    
    // 2. Validate minimum submit time
    const timeValidation = await validateMinSubmitTime(validation.submitStartTime);
    if (!timeValidation.valid) {
      return {
        valid: false,
        error: `Submission too fast. Please wait at least ${timeValidation.requiredTime} seconds.`
      };
    }
    
    // 3. Check rate limits
    const rateLimitCheck = await recordAndCheckRateLimit({
      userId,
      action,
      headers: validation.headers
    });
    
    if (!rateLimitCheck.allowed) {
      return {
        valid: false,
        error: `Rate limit exceeded. Try again in ${rateLimitCheck.retryAfter} seconds.`,
        rateLimitInfo: rateLimitCheck
      };
    }
    
    return {
      valid: true,
      rateLimitInfo: rateLimitCheck
    };
    
  } catch (error) {
    return {
      valid: false,
      error: 'Validation failed'
    };
  }
}

// Export testable functions
export const __testables__ = {
  InMemoryRateLimiter,
  extractIpFromHeaders,
  isValidIp,
  validateHoneypot,
  validateMinSubmitTime
};