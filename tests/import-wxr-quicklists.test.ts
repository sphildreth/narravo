// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";

function normalizeLists(html: string): string {
  // Mirrors the list normalization seen in the existing tests
  // Remove <p> directly wrapping <ul> or <ol>
  html = html.replace(/<p>\s*(<(?:ul|ol)[\s\S]*?>)\s*<\/p>/gi, "$1");
  // Remove <p> inside list items (opening)
  html = html.replace(/<li>\s*<p>/gi, "<li>");
  // Remove </p> inside list items (closing)
  html = html.replace(/<\/p>\s*<\/li>/gi, "</li>");
  return html;
}

describe("List normalization", () => {
  it("unwraps paragraphs around and inside lists", () => {
    const input = `<p>Intro paragraph.</p>
<p><ul><li><p>First item</p></li><li><p>Second item</p></li></ul></p>
<p>Outro paragraph.</p>`;
    const html = normalizeLists(input);
    expect(html).not.toMatch(/<p>\s*<(?:ul|ol)/i);
    expect(html).not.toMatch(/<li>\s*<p>/i);
    expect(html).not.toMatch(/<\/p>\s*<\/li>/i);
    expect(html).toMatch(/<ul>[\s\S]*<li>First item<\/li>[\s\S]*<li>Second item<\/li>[\s\S]*<\/ul>/i);
    expect(html).toMatch(/<p>Intro paragraph\.<\/p>/i);
    expect(html).toMatch(/<p>Outro paragraph\.<\/p>/i);
  });
});
