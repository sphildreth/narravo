// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { normalizeHtml } from "./normalizeHtml";

describe("HTML Normalizer", () => {
  it("should strip script and style elements", () => {
    const html = `<p>Safe content</p><script>alert('dangerous')</script><style>body { color: red; }</style>`;
    const result = normalizeHtml(html);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<style>');
    expect(result).toContain('Safe content');
  });

  it("should preserve basic elements", () => {
    const html = `<p>Paragraph</p><strong>Bold</strong><em>Italic</em>`;
    const result = normalizeHtml(html);
    expect(result).toContain('<p>Paragraph</p>');
    expect(result).toContain('<strong>Bold</strong>');
    expect(result).toContain('<em>Italic</em>');
  });

  it("should preserve list structure", () => {
    const html = `
      <ul>
        <li>Item 1</li>
        <li>Item 2
          <ul>
            <li>Nested 1</li>
          </ul>
        </li>
      </ul>
    `;
    const result = normalizeHtml(html);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Nested 1</li>');
  });

  it("should normalize line endings", () => {
    const html = "Line 1\r\nLine 2\rLine 3\nLine 4";
    const result = normalizeHtml(`<p>${html}</p>`);
    // All line endings should be normalized to \n, but content should be preserved
    expect(result).not.toContain('\r\n');
    expect(result).not.toContain('\r');
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 4');
  });

  it("should preserve table structure", () => {
    const html = `
      <table>
        <tr><th>Header</th></tr>
        <tr><td>Data</td></tr>
      </table>
    `;
    const result = normalizeHtml(html);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Header</th>');
    expect(result).toContain('<td>Data</td>');
  });

  it("should preserve pre and code elements", () => {
    const html = `<pre><code>const x = "test";</code></pre>`;
    const result = normalizeHtml(html);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
    expect(result).toContain('const x = "test";');
    expect(result).not.toContain('&amp;'); // No double-escaping
  });

  it("should return empty string for empty input", () => {
    expect(normalizeHtml("")).toBe("");
    expect(normalizeHtml("   ")).toBe("");
  });

  it("should handle blockquotes", () => {
    const html = `<blockquote><p>Quoted text</p></blockquote>`;
    const result = normalizeHtml(html);
    expect(result).toContain('<blockquote>');
    expect(result).toContain('Quoted text');
  });

  // Test the key functionality that the WXR tests actually need
  it("should provide consistent output for snapshot testing", () => {
    const html = `<p>Test content</p><ul><li>Item</li></ul>`;
    const result1 = normalizeHtml(html);
    const result2 = normalizeHtml(html);
    expect(result1).toBe(result2); // Must be deterministic
  });
});