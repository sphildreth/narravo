// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { markdownToHtmlSync } from "@/lib/markdown";

describe("Task List Rendering", () => {
  const fixtureContent = readFileSync(
    join(__dirname, "fixtures", "task-list-test.md"),
    "utf-8"
  );

  it("loads the task list fixture successfully", () => {
    expect(fixtureContent).toBeTruthy();
    expect(fixtureContent).toContain("Task List Test");
    expect(fixtureContent).toContain("- [x]");
    expect(fixtureContent).toContain("- [ ]");
  });

  describe("Basic task list structure", () => {
    const html = markdownToHtmlSync(fixtureContent);

    it("renders task lists as standard HTML lists", () => {
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
    });

    it("renders checkboxes with correct checked states", () => {
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('checked=""');
      expect(html).toContain('disabled');
    });

    it("renders task text content correctly", () => {
      expect(html).toContain("Completed task with");
      expect(html).toContain("Incomplete task with");
      expect(html).toContain("Another completed task with");
    });

    it("preserves formatting within task items", () => {
      expect(html).toContain("<strong>bold text</strong>");
      expect(html).toContain("<em>italic text</em>");
      expect(html).toContain("<code>inline code</code>");
    });
  });

  describe("Nested task list structure", () => {
    const html = markdownToHtmlSync(fixtureContent);

    it("renders nested task lists correctly", () => {
      expect(html).toContain("Parent task completed");
      expect(html).toContain("Nested completed task");
      expect(html).toContain("Third level nesting");
    });

    it("maintains proper nesting hierarchy", () => {
      // Should contain nested ul elements within list items
      const nestedListPattern = /<li>.*<ul>/s;
      expect(html).toMatch(nestedListPattern);
    });

    it("handles long text wrapping in nested tasks", () => {
      expect(html).toContain("longer text that should wrap properly");
      expect(html).toContain("even longer text that definitely should wrap");
    });
  });

  describe("Mixed content in task lists", () => {
    const html = markdownToHtmlSync(fixtureContent);

    it("handles paragraphs within task items", () => {
      expect(html).toContain("This is a paragraph inside a task item");
    });

    it("handles nested bullet points within tasks", () => {
      expect(html).toContain("Regular bullet point inside task");
      expect(html).toContain("Another bullet point");
    });
  });

  describe("Link rendering in task lists", () => {
    const html = markdownToHtmlSync(fixtureContent);

    it("renders links within task items correctly", () => {
      expect(html).toContain('href="https://openai.com"');
      expect(html).toContain(">OpenAI</a>");
    });

    it("applies proper link attributes for external links", () => {
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it("preserves links alongside other inline elements", () => {
      // Should contain both link and code elements in the same task
      const taskWithLinkAndCode = html.match(
        /<li>.*<a[^>]*href="https:\/\/openai\.com".*<code>pnpm dev<\/code>/s
      );
      expect(taskWithLinkAndCode).toBeTruthy();
    });

    it("renders multiple links in the same task correctly", () => {
      const linkMatches = html.match(/href="https:\/\/openai\.com"/g);
      expect(linkMatches).toBeTruthy();
      expect(linkMatches!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Task list accessibility", () => {
    const html = markdownToHtmlSync(fixtureContent);

    it("includes proper checkbox input elements", () => {
      expect(html).toContain('type="checkbox"');
    });

    it("maintains semantic list structure", () => {
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
    });

    it("includes proper checkbox states", () => {
      expect(html).toContain('checked');
      expect(html).toContain('disabled');
    });
  });

  describe("Content sanitization", () => {
    const html = markdownToHtmlSync(fixtureContent);

    it("does not contain dangerous HTML elements", () => {
      expect(html).not.toContain('<script');
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('onload=');
      expect(html).not.toContain('onclick=');
    });

    it("preserves safe HTML structure", () => {
      expect(html).toContain('<h1>');
      expect(html).toContain('<h2>');
      expect(html).toContain('<p>');
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
      expect(html).toContain('<code>');
    });
  });
});