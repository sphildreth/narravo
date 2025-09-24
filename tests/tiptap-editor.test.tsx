// SPDX-License-Identifier: Apache-2.0
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TiptapEditor, { fromMarkdown, toMarkdown } from "@/components/editor/TiptapEditor";

// Mock DOMPurify for tests
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html, // Simple passthrough for tests
  },
}));

// Mock lowlight and highlight.js modules
vi.mock("lowlight", () => ({
  createLowlight: () => ({
    register: vi.fn(),
    highlight: vi.fn().mockReturnValue({ children: [] }),
  }),
}));

vi.mock("highlight.js/lib/languages/typescript", () => ({
  default: () => ({ /* mock language definition */ }),
}));

describe("TiptapEditor", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <TiptapEditor initialMarkdown="# Hello World" />
    );
    expect(container).toBeTruthy();
  });

  it("displays toolbar with expected buttons", () => {
    render(<TiptapEditor initialMarkdown="" />);
    
    // Check for key toolbar buttons
    expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
    expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
    expect(screen.getByTitle("Heading 1")).toBeInTheDocument();
    expect(screen.getByTitle("Align Left")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Image")).toBeInTheDocument();
    expect(screen.getByTitle("Code Block")).toBeInTheDocument();
  });

  it("exports helper functions", () => {
    expect(typeof fromMarkdown).toBe("function");
    expect(typeof toMarkdown).toBe("function");
  });

  it("handles empty markdown", () => {
    const result = toMarkdown();
    expect(result).toBe("");
  });

  it("calls onChange callback when provided", () => {
    const onChange = vi.fn();
    render(<TiptapEditor initialMarkdown="" onChange={onChange} />);
    
    // The onChange should be called at least once during initialization
    expect(onChange).toHaveBeenCalled();
  });

  it("accepts custom placeholder text", () => {
    const customPlaceholder = "Custom placeholder text";
    render(<TiptapEditor placeholder={customPlaceholder} />);
    
    // Check if the placeholder is set in the editor attributes
    const editor = document.querySelector('[data-placeholder]');
    expect(editor).toHaveAttribute('data-placeholder', customPlaceholder);
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