// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateAntiAbuse } from '@/lib/rateLimit';

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {}
}));

// Mock the config service
const mockGetNumber = vi.fn();
vi.mock("@/lib/config", () => ({
  ConfigServiceImpl: vi.fn().mockImplementation(() => ({
    getNumber: mockGetNumber
  }))
}));

describe('Comment Form Timing Fix', () => {
  beforeEach(() => {
    // Setup default config values
    mockGetNumber.mockImplementation((key: string) => {
      const defaults: Record<string, number> = {
        'RATE.COMMENTS-PER-MINUTE': 5,
        'RATE.MIN-SUBMIT-SECS': 2
      };
      return Promise.resolve(defaults[key] || null);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow submission when submitStartTime is properly set and enough time has passed', async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const formStartTime = Date.now() - 3000; // 3 seconds ago (more than the 2-second minimum)

    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "", // Empty honeypot (correct)
      submitStartTime: formStartTime, // Proper start time
      headers: new Headers({ 'x-real-ip': '192.168.1.1' })
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.rateLimitInfo?.allowed).toBe(true);
  });

  it('should reject submission when submitStartTime is null/undefined', async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;

    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "",
      submitStartTime: null, // This was the original bug
      headers: new Headers({ 'x-real-ip': '192.168.1.1' })
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Submission too fast");
    expect(result.error).toContain("2 seconds");
  });

  it('should reject submission when not enough time has passed since form load', async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const formStartTime = Date.now() - 500; // Only 0.5 seconds ago (less than 2-second minimum)

    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "",
      submitStartTime: formStartTime,
      headers: new Headers({ 'x-real-ip': '192.168.1.1' })
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Submission too fast");
    expect(result.error).toContain("2 seconds");
  });

  it('should reject submission when honeypot is filled', async () => {
    const uniqueUserId = `user-${Date.now()}-${Math.random()}`;
    const formStartTime = Date.now() - 3000; // Proper timing

    const result = await validateAntiAbuse(uniqueUserId, "comment", {
      honeypot: "spam-content", // Honeypot filled (indicates bot)
      submitStartTime: formStartTime,
      headers: new Headers({ 'x-real-ip': '192.168.1.1' })
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid form submission");
  });
});