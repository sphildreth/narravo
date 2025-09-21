// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../lib/sanitize";
describe("sanitizeHtml", () => {
  it("removes scripts and inline handlers", () => {
    const bad = `<img src=x onerror=alert(1) /><script>alert(2)</script>`;
    const out = sanitizeHtml(bad);
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<script>");
  });
});
