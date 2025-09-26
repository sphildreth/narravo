// SPDX-License-Identifier: Apache-2.0
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

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

// Mock highlight.js language modules
vi.mock("highlight.js/lib/languages/typescript", () => ({ default: () => ({}) }));
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

import TiptapEditor, { fromMarkdown } from "@/components/editor/TiptapEditor";

// Create a simple CSS injection for testing
const injectCSS = (css: string) => {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = css;
  document.head.appendChild(style);
  return style;
};

// Basic task list CSS for testing - updated to match actual TipTap structure
const taskListCSS = `
.prose ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
  margin: 1rem 0;
}

.prose ul[data-type="taskList"] li[data-checked] {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 0.5rem 0;
  line-height: 1.6;
}

.prose ul[data-type="taskList"] li[data-checked] > label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
  flex-shrink: 0;
}

.prose ul[data-type="taskList"] li[data-checked] > label > input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border-radius: 0.375rem;
  border: 1px solid #ccc;
  margin-top: 0.125rem;
}

.prose ul[data-type="taskList"] li[data-checked] > div {
  flex: 1;
}

.prose ul[data-type="taskList"] li[data-checked] > div > p {
  margin: 0;
  color: inherit;
  font-size: inherit;
}

.prose ul[data-type="taskList"] ul[data-type="taskList"] {
  padding-left: 1.5rem;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}
`;

beforeEach(() => {
  cleanup();
  // Clean up any existing styles
  document.querySelectorAll('style[data-test]').forEach(el => el.remove());
});

afterEach(() => {
  cleanup();
  // Clean up styles after each test
  document.querySelectorAll('style[data-test]').forEach(el => el.remove());
});

describe("TipTap Editor Task List Rendering", () => {
  const taskListMarkdown = `# Task List Test

- [x] Completed task with **bold text**
- [ ] Incomplete task with *italic text*
- [x] Another completed task
- [ ] Parent task with nested items
  - [x] Nested completed task
  - [ ] Nested incomplete task with longer text that should wrap properly and align with the checkbox
  - [ ] Another nested task
    - [x] Third level task
    - [ ] Third level incomplete`;

  it("renders task lists with proper TipTap structure", async () => {
    const styleEl = injectCSS(taskListCSS);
    styleEl.setAttribute('data-test', 'true');
    
    const { container } = render(
      <div className="prose">
        <TiptapEditor initialMarkdown={taskListMarkdown} />
      </div>
    );

    // Wait for TipTap to initialize and render content
    await waitFor(() => {
      const taskLists = container.querySelectorAll('ul[data-type="taskList"]');
      expect(taskLists.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Check that task lists have the correct data attributes
    const taskLists = container.querySelectorAll('ul[data-type="taskList"]');
    expect(taskLists.length).toBeGreaterThan(0);

    // Check that task items exist (they have data-checked but not data-type="taskItem" in current TipTap version)
    const taskItems = container.querySelectorAll('ul[data-type="taskList"] li[data-checked]');
    expect(taskItems.length).toBeGreaterThan(0);

    // Verify the main task list doesn't have list-style
    const mainTaskList = taskLists[0] as HTMLElement;
    const computedStyles = window.getComputedStyle(mainTaskList);
    expect(computedStyles.listStyle).toBe('none');
    expect(computedStyles.paddingLeft).toBe('0px');
  });

  it("validates task item layout and alignment", async () => {
    const styleEl = injectCSS(taskListCSS);
    styleEl.setAttribute('data-test', 'true');
    
    const { container } = render(
      <div className="prose">
        <TiptapEditor initialMarkdown={taskListMarkdown} />
      </div>
    );

    await waitFor(() => {
      const taskItems = container.querySelectorAll('ul[data-type="taskList"] li[data-checked]');
      expect(taskItems.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const taskItems = container.querySelectorAll('ul[data-type="taskList"] li[data-checked]');
    
    // Check each task item has proper flexbox layout
    taskItems.forEach((taskItem) => {
      const computedStyles = window.getComputedStyle(taskItem as HTMLElement);
      expect(computedStyles.display).toBe('flex');
      expect(computedStyles.alignItems).toBe('flex-start');
    });

    // Check that task items have proper structure (label > input + span, div > p for content)
    const firstTaskItem = taskItems[0];
    expect(firstTaskItem).toBeTruthy();
    
    const label = firstTaskItem?.querySelector('label');
    expect(label).toBeTruthy();
    
    const checkbox = label?.querySelector('input[type="checkbox"]');
    const textDiv = firstTaskItem?.querySelector('div');
    
    expect(checkbox).toBeTruthy();
    expect(textDiv).toBeTruthy();    // Verify checkbox positioning
    if (checkbox) {
      const checkboxStyles = window.getComputedStyle(checkbox as HTMLElement);
      expect(checkboxStyles.flexShrink).toBe('0');
      expect(checkboxStyles.width).toBe('1rem');
      expect(checkboxStyles.height).toBe('1rem');
    }

    // Verify text content is in the div
    if (textDiv) {
      const paragraph = textDiv.querySelector('p');
      expect(paragraph).toBeTruthy();
      expect(paragraph?.textContent).toContain('Completed task');
    }
  });

  it("handles nested task lists correctly", async () => {
    const styleEl = injectCSS(taskListCSS);
    styleEl.setAttribute('data-test', 'true');
    
    const { container } = render(
      <div className="prose">
        <TiptapEditor initialMarkdown={taskListMarkdown} />
      </div>
    );

    await waitFor(() => {
      const taskLists = container.querySelectorAll('ul[data-type="taskList"]');
      expect(taskLists.length).toBeGreaterThan(1); // Should have nested lists
    }, { timeout: 5000 });

    const taskLists = container.querySelectorAll('ul[data-type="taskList"]');
    
    // Find nested task lists (not the top-level one)
    const nestedTaskLists = Array.from(taskLists).filter((list, index) => index > 0);
    expect(nestedTaskLists.length).toBeGreaterThan(0);

    // Check nested lists have proper indentation
    nestedTaskLists.forEach((nestedList) => {
      const computedStyles = window.getComputedStyle(nestedList as HTMLElement);
      expect(computedStyles.paddingLeft).toBe('1.5rem');
    });
  });

  it("preserves text formatting within task items", async () => {
    const styleEl = injectCSS(taskListCSS);
    styleEl.setAttribute('data-test', 'true');
    
    const { container } = render(
      <div className="prose">
        <TiptapEditor initialMarkdown={taskListMarkdown} />
      </div>
    );

    await waitFor(() => {
      const taskItems = container.querySelectorAll('ul[data-type="taskList"] li[data-checked]');
      expect(taskItems.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Check for bold text in first task
    const boldText = container.querySelector('ul[data-type="taskList"] li[data-checked] strong');
    expect(boldText).toBeTruthy();
    expect(boldText?.textContent).toBe('bold text');

    // Check for italic text in second task  
    const italicText = container.querySelector('ul[data-type="taskList"] li[data-checked] em');
    expect(italicText).toBeTruthy();
    expect(italicText?.textContent).toBe('italic text');
  });

  it("ensures checkboxes are interactive", async () => {
    const styleEl = injectCSS(taskListCSS);
    styleEl.setAttribute('data-test', 'true');
    
    const { container } = render(
      <div className="prose">
        <TiptapEditor initialMarkdown={taskListMarkdown} />
      </div>
    );

    await waitFor(() => {
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    
    // Verify checkboxes exist and have correct states
    expect(checkboxes.length).toBeGreaterThan(0);

    // Check that some checkboxes are checked (for [x] items)
    const checkedBoxes = Array.from(checkboxes).filter((cb) => 
      (cb as HTMLInputElement).checked
    );
    expect(checkedBoxes.length).toBeGreaterThan(0);

    // Check that some checkboxes are not checked (for [ ] items)
    const uncheckedBoxes = Array.from(checkboxes).filter((cb) => 
      !(cb as HTMLInputElement).checked
    );
    expect(uncheckedBoxes.length).toBeGreaterThan(0);
  });

  it("validates visual layout with fixture content", async () => {
    const styleEl = injectCSS(taskListCSS);
    styleEl.setAttribute('data-test', 'true');
    
    // Load the fixture content we created earlier
    const fixtureContent = readFileSync(
      join(__dirname, "fixtures", "task-list-test.md"),
      "utf-8"
    );

    const { container } = render(
      <div className="prose">
        <TiptapEditor initialMarkdown={fixtureContent} />
      </div>
    );

    await waitFor(() => {
      const taskLists = container.querySelectorAll('ul[data-type="taskList"]');
      expect(taskLists.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Test with longer content to ensure wrapping works correctly
    const longTextTask = Array.from(container.querySelectorAll('ul[data-type="taskList"] li[data-checked]'))
      .find(item => item.textContent?.includes('even longer text'));
    
    expect(longTextTask).toBeTruthy();
    
    if (longTextTask) {
      const computedStyles = window.getComputedStyle(longTextTask as HTMLElement);
      expect(computedStyles.display).toBe('flex');
      expect(computedStyles.alignItems).toBe('flex-start');
      
      // Ensure the checkbox stays at the top while text wraps
      const checkbox = longTextTask.querySelector('input[type="checkbox"]');
      if (checkbox) {
        const checkboxStyles = window.getComputedStyle(checkbox as HTMLElement);
        expect(checkboxStyles.marginTop).toBe('0.125rem'); // Slight top alignment
      }
    }
  });
});