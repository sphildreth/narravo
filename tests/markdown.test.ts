// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { markdownToHtmlSync, extractExcerpt, isMarkdown } from "@/lib/markdown";

describe("markdownToHtmlSync", () => {
  it("converts basic markdown to HTML", () => {
    const markdown = "# Hello World\n\nThis is **bold** and *italic* text.";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain("<h1>Hello World</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("handles code blocks and inline code", () => {
    const markdown = "Here is `inline code` and:\n\n```javascript\nconst x = 1;\n```";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain("<code>inline code</code>");
    expect(html).toContain("<pre><code");
    expect(html).toContain("const x = 1;");
  });

  it("converts lists correctly", () => {
    const markdown = "- Item 1\n- Item 2\n\n1. Numbered\n2. List";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Numbered</li>");
  });

  it("handles blockquotes", () => {
    const markdown = "> This is a quote\n> spanning multiple lines";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain("<blockquote>");
    expect(html).toContain("This is a quote");
  });

  it("makes external links safe", () => {
    const markdown = "[External Link](https://example.com) and [Internal](/page)";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="/page"');
  });

  it("handles images safely", () => {
    const markdown = "![Alt text](https://example.com/image.jpg)";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/image.jpg"');
    expect(html).toContain('alt="Alt text"');
  });

  it("blocks dangerous image URLs", () => {
    const markdown = "![Alt text](javascript:alert('xss'))";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).not.toContain('javascript:');
    // DOMPurify will remove the src attribute or make it safe
    expect(html).toContain('alt="Alt text"');
  });

  it("prevents XSS attempts", () => {
    const markdown = `<script>alert('xss')</script>\n\n**Bold** text`;
    const html = markdownToHtmlSync(markdown);
    
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(');
    expect(html).toContain('<strong>Bold</strong>'); // Should still process valid markdown
  });

  it("handles empty or invalid input gracefully", () => {
    expect(markdownToHtmlSync("")).toBe("");
    expect(markdownToHtmlSync(null as any)).toBe("");
    expect(markdownToHtmlSync(undefined as any)).toBe("");
  });

  it("handles line breaks correctly", () => {
    const markdown = "Line 1\nLine 2\n\nParagraph 2";
    const html = markdownToHtmlSync(markdown);
    
    expect(html).toContain("<br>");
    expect(html).toContain("<p>Paragraph 2</p>");
  });
});

describe("extractExcerpt", () => {
  it("extracts plain text from markdown", () => {
    const markdown = "# Title\n\nThis is **bold** and *italic* text with [a link](http://example.com).";
    const excerpt = extractExcerpt(markdown, 50);
    
    expect(excerpt).toBe("Title This is bold and italic text with a link.");
    expect(excerpt).not.toContain("**");
    expect(excerpt).not.toContain("*");
    expect(excerpt).not.toContain("[");
    expect(excerpt).not.toContain("#");
  });

  it("truncates long content", () => {
    const longMarkdown = "This is a very long piece of content that should be truncated when it exceeds the maximum length specified for the excerpt.";
    const excerpt = extractExcerpt(longMarkdown, 50);
    
    expect(excerpt.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(excerpt).toContain("...");
  });

  it("breaks at word boundaries", () => {
    const markdown = "The quick brown fox jumps over the lazy dog";
    const excerpt = extractExcerpt(markdown, 20);
    
    expect(excerpt).toBe("The quick brown fox...");
    expect(excerpt).not.toContain("jump"); // Should not break mid-word
  });

  it("handles short content without truncation", () => {
    const markdown = "Short content";
    const excerpt = extractExcerpt(markdown, 100);
    
    expect(excerpt).toBe("Short content");
    expect(excerpt).not.toContain("...");
  });

  it("handles empty input gracefully", () => {
    expect(extractExcerpt("")).toBe("");
    expect(extractExcerpt(null as any)).toBe("");
    expect(extractExcerpt(undefined as any)).toBe("");
  });

  it("removes HTML from markdown conversion", () => {
    const markdown = "# Header\n\n**Bold** and `code` text.";
    const excerpt = extractExcerpt(markdown, 100);
    
    expect(excerpt).toBe("Header Bold and code text.");
    expect(excerpt).not.toContain("<");
    expect(excerpt).not.toContain(">");
  });
});

describe("isMarkdown", () => {
  it("detects markdown headers", () => {
    expect(isMarkdown("# Header")).toBe(true);
    expect(isMarkdown("## Another Header")).toBe(true);
    expect(isMarkdown("### Yet Another")).toBe(true);
  });

  it("detects markdown lists", () => {
    expect(isMarkdown("* List item")).toBe(true);
    expect(isMarkdown("- Another list")).toBe(true);
    expect(isMarkdown("1. Numbered list")).toBe(true);
  });

  it("detects markdown formatting", () => {
    expect(isMarkdown("**bold text**")).toBe(true);
    expect(isMarkdown("*italic text*")).toBe(true);
    expect(isMarkdown("`inline code`")).toBe(true);
  });

  it("detects markdown links", () => {
    expect(isMarkdown("[link text](http://example.com)")).toBe(true);
  });

  it("detects code blocks", () => {
    expect(isMarkdown("```\ncode block\n```")).toBe(true);
  });

  it("detects blockquotes", () => {
    expect(isMarkdown("> This is a quote")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isMarkdown("Just plain text with no markdown")).toBe(false);
    expect(isMarkdown("Regular sentence.")).toBe(false);
  });

  it("handles empty or invalid input", () => {
    expect(isMarkdown("")).toBe(false);
    expect(isMarkdown(null as any)).toBe(false);
    expect(isMarkdown(undefined as any)).toBe(false);
  });

  it("detects mixed content", () => {
    const mixedContent = `
      Regular text here.
      
      # But also a header
      
      And some **bold** text.
    `;
    expect(isMarkdown(mixedContent)).toBe(true);
  });
});