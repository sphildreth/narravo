// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeCommentHtml } from "../lib/sanitize";

describe("sanitizeHtml", () => {
  it("removes scripts and inline handlers", () => {
    const bad = `<img src=x onerror=alert(1) /><script>alert(2)</script>`;
    const out = sanitizeHtml(bad);
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<script>");
  });

  it("allows safe HTML tags", () => {
    const safe = `<p>Safe <strong>bold</strong> and <em>italic</em> text with <a href="/page">link</a></p>`;
    const out = sanitizeHtml(safe);
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain('<a href="/page">');
  });

  it("allows headers and other formatting", () => {
    const content = `<h1>Header</h1><blockquote>Quote</blockquote><code>code</code><pre>preformatted</pre>`;
    const out = sanitizeHtml(content);
    expect(out).toContain("<h1>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("<code>");
    expect(out).toContain("<pre>");
  });

  it("allows external links and preserves their attributes", () => {
    const content = `<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>`;
    const out = sanitizeHtml(content);
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe("sanitizeCommentHtml", () => {
  it("is more restrictive than general sanitizeHtml", () => {
    const content = `<img src="test.jpg" alt="test"><h1>Header</h1><p>Text</p>`;
    const generalOut = sanitizeHtml(content);
    const commentOut = sanitizeCommentHtml(content);
    
    // General sanitizer allows images and headers
    expect(generalOut).toContain("<img");
    expect(generalOut).toContain("<h1>");
    
    // Comment sanitizer blocks images and headers
    expect(commentOut).not.toContain("<img");
    expect(commentOut).not.toContain("<h1>");
    expect(commentOut).toContain("<p>"); // But still allows basic formatting
  });

  it("allows basic comment formatting", () => {
    const content = `<p>Comment with <strong>bold</strong>, <em>italic</em>, and <a href="/link">link</a></p>`;
    const out = sanitizeCommentHtml(content);
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain("<a");
  });

  it("removes dangerous attributes", () => {
    const bad = `<p onclick="alert('xss')" style="color:red" class="dangerous">Text</p>`;
    const out = sanitizeCommentHtml(bad);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("style");
    expect(out).not.toContain("class");
    expect(out).toContain("Text"); // Should keep the content
  });
});
