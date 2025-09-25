// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { loadFixture, listFixtures } from "./fixtures";

describe("Fixture Helper", () => {
  it("should list fixtures correctly", () => {
    const fixtures = listFixtures();
    expect(fixtures).toContain("wxr_minimal.xml");
    expect(fixtures).toContain("wxr_html_lists.xml");
    expect(fixtures.every(f => f.endsWith('.xml') || f.endsWith('.wxr'))).toBe(true);
    expect(fixtures).toEqual([...fixtures].sort()); // Should be sorted
  });

  it("should load existing fixtures", () => {
    const content = loadFixture("wxr_minimal.xml");
    expect(content).toContain("<?xml version=");
    expect(content).toContain("<rss version=");
    expect(content).toContain("Hello World");
  });

  it("should provide helpful error with suggestions for typos", () => {
    try {
      loadFixture("wxr_minimul.xml"); // typo: minimul instead of minimal
      expect.fail("Should have thrown an error");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Error loading fixture: wxr_minimul.xml");
      expect(message).toContain("Did you mean one of these?");
      expect(message).toContain("wxr_minimal.xml"); // Should suggest the correct name
    }
  });

  it("should list all available fixtures when fixture not found", () => {
    try {
      loadFixture("nonexistent.xml");
      expect.fail("Should have thrown an error");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("All available fixtures:");
      expect(message).toContain("wxr_minimal.xml");
    }
  });
});