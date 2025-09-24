// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import TiptapEditor, { fromMarkdown, toMarkdown } from "@/components/editor/TiptapEditor";

// Mock DOMPurify for tests
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html, // Simple passthrough for tests
  },
}));

// Mock highlight.js modules
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

  it("exports helper functions", () => {
    expect(typeof fromMarkdown).toBe("function");
    expect(typeof toMarkdown).toBe("function");
  });

  it("handles empty markdown", () => {
    const result = toMarkdown();
    expect(result).toBe("");
  });
});