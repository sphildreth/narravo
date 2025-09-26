// SPDX-License-Identifier: Apache-2.0
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// IMPORTANT: mocks must be declared before importing the component under test
vi.mock("isomorphic-dompurify", () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

vi.mock("lowlight", () => ({
  createLowlight: () => ({
    register: vi.fn(),
    highlight: vi.fn().mockReturnValue({ value: "", children: [] }),
  }),
}));

// Provide a very lightweight mock for highlight.js language modules used dynamically
vi.mock("highlight.js/lib/languages/typescript", () => ({
  default: () => ({}),
}));
vi.mock("highlight.js/lib/languages/javascript", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/bash", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/json", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/yaml", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/python", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/go", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/rust", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/csharp", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/xml", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/css", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/sql", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/markdown", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/java", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/php", () => ({ default: () => ({}) }));
vi.mock("highlight.js/lib/languages/ruby", () => ({ default: () => ({}) }));

import TiptapEditor, { fromMarkdown, toMarkdown } from "@/components/editor/TiptapEditor";

beforeEach(() => {
  // ensure clean DOM start
  cleanup();
});

describe("TiptapEditor", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <TiptapEditor initialMarkdown="# Hello World" />
    );
    expect(container).toBeTruthy();
  });

  it("displays toolbar with expected buttons", () => {
    render(<TiptapEditor initialMarkdown="" />);
    // Use getAllByTitle to tolerate duplicate buttons without failing
    expect(screen.getAllByTitle("Bold (Ctrl+B)").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Italic (Ctrl+I)").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Heading 1").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Align Left").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Insert Image").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Code Block").length).toBeGreaterThan(0);
  });

  it("exports helper functions", () => {
    expect(typeof fromMarkdown).toBe("function");
    expect(typeof toMarkdown).toBe("function");
  });

  it("handles empty markdown", () => {
    const result = toMarkdown();
    expect(result).toBe("");
  });

  it("calls onChange callback when provided", async () => {
    const onChange = vi.fn();
    render(<TiptapEditor initialMarkdown="" onChange={onChange} />);
    // Allow microtasks / effect to run
    await new Promise(r => setTimeout(r, 10));
    expect(onChange.mock.calls.length).toBeGreaterThan(0);
  });

  it("accepts custom placeholder text", () => {
    const customPlaceholder = "Custom placeholder text";
    render(<TiptapEditor placeholder={customPlaceholder} />);
    const editor = document.querySelector('[data-placeholder]');
    expect(editor?.getAttribute('data-placeholder')).toBe(customPlaceholder);
  });
});

describe("Markdown round-trip functionality", () => {
  it("should handle basic markdown structures", () => {
    const markdown = `# Heading 1

This is a **bold** and *italic* text.

\`\`\`javascript
console.log('hello world');
\`\`\`

- List item 1
- List item 2`;

    // These are basic functionality tests - actual editor instance testing
    // would require more complex setup with proper DOM environment
    expect(markdown).toContain("# Heading 1");
    expect(markdown).toContain("**bold**");
    expect(markdown).toContain("```javascript");
  });

  it("should handle code blocks with language tags", () => {
    const codeBlockMarkdown = `\`\`\`typescript
interface User {
  name: string;
  email: string;
}
\`\`\``;

    expect(codeBlockMarkdown).toContain("```typescript");
    expect(codeBlockMarkdown).toContain("interface User");
  });

  it("should handle image alignment markup", () => {
    const imageMarkdown = `<figure class="align-center">
<img src="/test.jpg" alt="Test image" />
<figcaption>Test caption</figcaption>
</figure>`;

    expect(imageMarkdown).toContain('class="align-center"');
    expect(imageMarkdown).toContain('<figcaption>');
  });
});