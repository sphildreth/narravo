// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { FRAME_SRC_HOSTS } from "@/lib/frame-src";

describe("frame-src", () => {
  describe("FRAME_SRC_HOSTS", () => {
    it("should be defined as an array", () => {
      expect(FRAME_SRC_HOSTS).toBeDefined();
      expect(Array.isArray(FRAME_SRC_HOSTS)).toBe(true);
    });

    it("should contain YouTube hosts", () => {
      expect(FRAME_SRC_HOSTS).toContain("https://*.youtube.com");
      expect(FRAME_SRC_HOSTS).toContain("https://*.youtube-nocookie.com");
    });

    it("should only contain HTTPS URLs", () => {
      FRAME_SRC_HOSTS.forEach((host) => {
        expect(host).toMatch(/^https:\/\//);
      });
    });

    it("should have expected number of entries", () => {
      // Currently 2 entries (YouTube and YouTube no-cookie)
      expect(FRAME_SRC_HOSTS.length).toBeGreaterThanOrEqual(2);
    });

    it("should support wildcard subdomains", () => {
      const wildcardHosts = FRAME_SRC_HOSTS.filter((host) => host.includes("*"));
      expect(wildcardHosts.length).toBeGreaterThan(0);
    });

    it("should not contain duplicate entries", () => {
      const uniqueHosts = new Set(FRAME_SRC_HOSTS);
      expect(uniqueHosts.size).toBe(FRAME_SRC_HOSTS.length);
    });

    it("should contain well-formed URLs", () => {
      FRAME_SRC_HOSTS.forEach((host) => {
        // Each entry should be a string
        expect(typeof host).toBe("string");
        
        // Should start with https://
        expect(host.startsWith("https://")).toBe(true);
        
        // Should not end with a slash
        expect(host.endsWith("/")).toBe(false);
      });
    });
  });

  describe("provider validation", () => {
    it("should include YouTube provider", () => {
      const hasYouTube = FRAME_SRC_HOSTS.some((host) =>
        host.includes("youtube.com")
      );
      expect(hasYouTube).toBe(true);
    });

    it("should include YouTube privacy-enhanced mode (no-cookie)", () => {
      const hasYouTubeNoCookie = FRAME_SRC_HOSTS.some((host) =>
        host.includes("youtube-nocookie.com")
      );
      expect(hasYouTubeNoCookie).toBe(true);
    });

    it("should support YouTube embeds from any subdomain", () => {
      const youtubeHosts = FRAME_SRC_HOSTS.filter((host) =>
        host.includes("youtube")
      );
      
      youtubeHosts.forEach((host) => {
        // Should use wildcard for subdomains (www, m, etc.)
        expect(host).toMatch(/https:\/\/\*\./);
      });
    });
  });

  describe("CSP compatibility", () => {
    it("should be usable in Content-Security-Policy headers", () => {
      // CSP frame-src directive format: frame-src 'self' https://domain.com;
      const cspValue = FRAME_SRC_HOSTS.join(" ");
      
      expect(cspValue).toBeTruthy();
      expect(cspValue).toContain("https://");
    });

    it("should be compatible with CSP wildcard syntax", () => {
      FRAME_SRC_HOSTS.forEach((host) => {
        // If it contains a wildcard, it should be at the subdomain level
        if (host.includes("*")) {
          // Pattern: https://*.domain.com or https://*.domain-name.com
          expect(host).toMatch(/https:\/\/\*\.[\w-]+\.[\w-]+/);
        }
      });
    });
  });
});
