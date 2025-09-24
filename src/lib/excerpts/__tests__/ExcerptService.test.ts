// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import {
  generateExcerpt,
  hasMoreMarker,
  extractBeforeMore,
  visibleTextLength,
} from "@/lib/excerpts/ExcerptService";

describe("ExcerptService", () => {
  it("respects <!--more--> marker", () => {
    const html = "<p>Intro</p><!--more--><p>Body</p>";
    expect(hasMoreMarker(html)).toBe(true);
    expect(extractBeforeMore(html)).toContain("Intro");
    expect(extractBeforeMore(html)).not.toContain("Body");
  });

  it("drops media and iframes in excerpt", () => {
    const html = '<p>' + 'Text '.repeat(10) + '</p><img src="x"><iframe src="y"></iframe>';
    const out = generateExcerpt(html, { maxChars: 50 });
    expect(out).toMatch(/Text/);
    expect(out).not.toMatch(/img|iframe/);
  });

  it("keeps inline formatting", () => {
    const html = "<p>" + "Hello <strong>world</strong> and <code>x</code> ".repeat(3) + "</p>";
    const out = generateExcerpt(html, { maxChars: 80 });
    expect(out).toMatch(/<strong>world<\/strong>/);
    expect(out).toMatch(/<code>x<\/code>/);
  });

  it("truncates with ellipsis when needed", () => {
    const html = "<p>" + "word ".repeat(200) + "</p>";
    const out = generateExcerpt(html, { maxChars: 120 });
    expect(visibleTextLength(out)).toBeLessThan(150);
    expect(out.endsWith("…") || out.includes("…")).toBeTruthy();
  });
});
