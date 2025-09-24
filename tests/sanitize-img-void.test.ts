// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml - img void element handling", () => {
  it("keeps self-closing <img /> inside figure", () => {
    const html = '<figure class="wp-block-image size-large"><img src="http://example.com/img.png" alt="" class="wp-image-1"/></figure>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<img src="http://example.com/img.png"');
  });

  it("keeps non-self-closing <img></img>", () => {
    const html = '<p><img src="http://example.com/img.png"></img></p>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<img src="http://example.com/img.png"');
  });
});
