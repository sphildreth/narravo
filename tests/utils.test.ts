// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("lib/utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      const result = cn("text-red-500", "bg-blue-500");
      expect(result).toBe("text-red-500 bg-blue-500");
    });

    it("should handle conditional classes", () => {
      const result = cn("base-class", true && "conditional-class", false && "hidden-class");
      expect(result).toBe("base-class conditional-class");
    });

    it("should deduplicate conflicting Tailwind classes", () => {
      const result = cn("px-2 py-1", "px-4");
      expect(result).toBe("py-1 px-4");
    });

    it("should handle empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("should handle arrays of classes", () => {
      const result = cn(["text-sm", "font-bold"], "text-gray-500");
      expect(result).toBe("text-sm font-bold text-gray-500");
    });

    it("should handle objects with boolean values", () => {
      const result = cn({
        "active": true,
        "disabled": false,
        "error": true,
      });
      expect(result).toBe("active error");
    });
  });
});
