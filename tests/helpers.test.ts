// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { loadFixture, listFixtures } from "./helpers/fixtures";
import { normalizeHtml, stripForbiddenAttributes, extractTextContent } from "./helpers/normalizeHtml";

describe("Test helpers", () => {
  describe("fixtures loader", () => {
    it("should list available fixtures", async () => {
      const fixtures = await listFixtures();
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures).toContain("wxr_minimal.xml");
    });

    it("should load a known fixture", async () => {
      const content = await loadFixture("wxr_minimal.xml");
      expect(content).toBeDefined();
      expect(content).toContain("<?xml");
      expect(content).toContain("Hello World");
    });

    it("should throw helpful error for missing fixture", async () => {
      expect(() => loadFixture("wxr_nonexistent.xml")).toThrow(/Fixture not found/);
    });

    it("should suggest similar fixture names for typos", async () => {
      expect(() => loadFixture("wxr_minimal.xm")).toThrow(/Similar fixtures found/);
    });
  });

  describe("HTML normalizer", () => {
    it("should normalize whitespace", () => {
      const html = "  <p>  Hello    world  </p>  ";
      const normalized = normalizeHtml(html);
      expect(normalized).toBe("<p> Hello world </p>");
    });

    it("should decode HTML entities once", () => {
      const html = "&nbsp;&amp;&lt;div&gt;";
      const normalized = normalizeHtml(html);
      expect(normalized).toBe("&<div>");
    });

    it("should sort attributes", () => {
      const html = '<img width="100" src="test.jpg" alt="test">';
      const normalized = normalizeHtml(html);
      expect(normalized).toBe('<img alt="test" src="test.jpg" width="100">');
    });

    it("should normalize line endings", () => {
      const html = "<p>Line 1\r\nLine 2\r</p>";
      const normalized = normalizeHtml(html);
      expect(normalized).toBe("<p>Line 1\nLine 2\n</p>");
    });
  });

  describe("HTML attribute filtering", () => {
    it("should preserve allowed attributes", () => {
      const html = '<img src="test.jpg" alt="test" onerror="alert(1)">';
      const filtered = stripForbiddenAttributes(html);
      expect(filtered).toContain('src="test.jpg"');
      expect(filtered).toContain('alt="test"');
      expect(filtered).not.toContain("onerror");
    });

    it("should preserve data attributes", () => {
      const html = '<div data-id="123" onclick="evil()">';
      const filtered = stripForbiddenAttributes(html);
      expect(filtered).toContain('data-id="123"');
      expect(filtered).not.toContain("onclick");
    });
  });

  describe("text extraction", () => {
    it("should extract text content from HTML", () => {
      const html = "<p>Hello <strong>world</strong>!</p>";
      const text = extractTextContent(html);
      expect(text).toBe("Hello world!");
    });
  });
});