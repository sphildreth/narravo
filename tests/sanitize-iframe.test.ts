// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml - iframe handling", () => {
  it("preserves YouTube iframe embeds", () => {
    const html = '<p>Video:</p>\n<iframe width="560" height="315" src="https://www.youtube.com/embed/TJTDTyNdJdY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="allowfullscreen"></iframe>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<iframe');
    expect(out).toContain('src="https://www.youtube.com/embed/TJTDTyNdJdY"');
  });

  it("strips non-YouTube iframes", () => {
    const html = '<iframe src="https://player.vimeo.com/video/12345" width="640" height="360" frameborder="0"></iframe>';
    const out = sanitizeHtml(html);
    expect(out).not.toContain('<iframe');
  });
});
