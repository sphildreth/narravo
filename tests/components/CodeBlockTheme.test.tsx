/** @vitest-environment jsdom */

// SPDX-License-Identifier: Apache-2.0
// The active theme is an attribute on <html> that ThemeToggle rewrites in place, so
// the highlighter palette must follow it. It used to sample data-theme once on
// mount, which left already-rendered code blocks in the old palette until reload.
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import CodeBlock from "@/components/CodeBlock";

describe("CodeBlock palette follows the document theme", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-theme");
  });

  it("re-tints when data-theme flips without a navigation", async () => {
    document.documentElement.dataset.theme = "light";
    const { container } = render(
      <CodeBlock language="typescript">{"const answer = 42;"}</CodeBlock>
    );
    const pre = container.querySelector("pre");
    if (!pre) throw new Error("CodeBlock did not render a <pre>");

    expect(pre.style.backgroundColor).toBe("white");

    document.documentElement.dataset.theme = "dark";

    // MutationObserver delivers on a microtask, so poll for the re-render.
    await expect.poll(() => pre.style.backgroundColor).toBe("rgb(30, 30, 30)");
  });
});
