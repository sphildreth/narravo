// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { formatDateSafe, DEFAULT_DATE_FORMAT } from "@/lib/dateFormat";

describe("lib/dateFormat", () => {
  describe("formatDateSafe", () => {
    it("should format Date object with default format", () => {
      const date = new Date("2025-04-25T12:00:00Z");
      const result = formatDateSafe(date);
      expect(result).toBe("April 25, 2025");
    });

    it("should format Date object with custom format", () => {
      const date = new Date("2025-04-25T12:00:00Z");
      const result = formatDateSafe(date, "yyyy-MM-dd");
      expect(result).toBe("2025-04-25");
    });

    it("should format ISO string with default format", () => {
      const result = formatDateSafe("2025-04-25T12:00:00Z");
      expect(result).toBe("April 25, 2025");
    });

    it("should format ISO string with custom format", () => {
      const result = formatDateSafe("2025-04-25T12:00:00Z", "MM/dd/yyyy");
      expect(result).toBe("04/25/2025");
    });

    it("should return empty string for null input", () => {
      const result = formatDateSafe(null);
      expect(result).toBe("");
    });

    it("should return empty string for undefined input", () => {
      const result = formatDateSafe(undefined);
      expect(result).toBe("");
    });

    it("should return empty string for invalid date string", () => {
      const result = formatDateSafe("invalid-date");
      expect(result).toBe("");
    });

    it("should return empty string for invalid Date object", () => {
      const result = formatDateSafe(new Date("invalid"));
      expect(result).toBe("");
    });

    it("should fallback to locale formatting for invalid format string", () => {
      const date = new Date("2025-04-25T12:00:00Z");
      const result = formatDateSafe(date, "invalid-format-string");
      // Should fall back to toLocaleDateString()
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should use DEFAULT_DATE_FORMAT constant", () => {
      expect(DEFAULT_DATE_FORMAT).toBe("MMMM d, yyyy");
    });

    it("should handle different time zones", () => {
      const date = new Date("2025-12-31T23:59:59Z");
      const result = formatDateSafe(date);
      expect(result).toContain("2025");
    });
  });
});
