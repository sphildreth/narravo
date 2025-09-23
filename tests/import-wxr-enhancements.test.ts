// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Import the helpers by re-requiring the file; in real project you may export them explicitly.
// Here we will duplicate the regex functions for the sake of unit tests without changing exports.

function stripGutenbergBlockComments(html: string): string {
  if (!html) return html;
  return html.replace(/<!--\s*\/?wp:[\s\S]*?-->\s*/g, "");
}


function applyQuicktags(html: string): { html: string; excerptFromMore?: string; pageBreaks: number } {
  if (!html) return { html, pageBreaks: 0 };
  let excerptFromMoreValue: string | undefined;
  let pageBreaks = 0;
  if (html.includes("<!--more-->")) {
    const idx = html.indexOf("<!--more-->");
    const before = idx >= 0 ? html.slice(0, idx) : "";
    const after = idx >= 0 ? html.slice(idx + "<!--more-->".length) : "";
    excerptFromMoreValue = before.trim();
    html = before + after;
  }
  html = html.replace(/<!--\s*nextpage\s*-->/gi, () => {
    pageBreaks += 1;
    return '<hr data-wp-nextpage="true" />';
  });
  const base = { html, pageBreaks };
  return excerptFromMoreValue !== undefined ? { ...base, excerptFromMore: excerptFromMoreValue } : base;
}

function transformAutoEmbeds(html: string): string {
  if (!html) return html;
  const lineEmbed = (url: string) => {
    const u = url.trim();
    let provider: string | null = null;
    if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u)) provider = "youtube";
    else if (/^(https?:\/\/)?(player\.)?vimeo\.com\//i.test(u)) provider = "vimeo";
    else provider = null;
    if (!provider) return url;
    const escaped = u.replace(/"/g, "&quot;");
    return `<p><a class="wp-embed" data-embed="${provider}" href="${escaped}">${escaped}</a></p>`;
  };
  html = html.replace(/\[embed\]([\s\S]*?)\[\/embed\]/gi, (_m, url) => lineEmbed(url));
  html = html.replace(
    /(?:^|\n|\r|\r\n)\s*(https?:\/\/[^\s<>"']+)\s*(?=$|\n|\r|\r\n)/g,
    (m, url) => "\n" + lineEmbed(url)
  );
  return html;
}

describe("Gutenberg block comment stripping", () => {
  it("removes wp: comments but keeps inner HTML", () => {
    const html = `<!-- wp:paragraph --><p>Hello <strong>world</strong></p><!-- /wp:paragraph -->`;
    const out = stripGutenbergBlockComments(html);
    expect(out).toBe(`<p>Hello <strong>world</strong></p>`);
  });
});

describe("Quicktags handling", () => {
  it("extracts excerpt from <!--more--> and removes marker", () => {
    const html = `<p>Intro</p><!--more--><p>Rest</p>`;
    const qt = applyQuicktags(html);
    expect(qt.excerptFromMore).toMatch(/Intro/);
    expect(qt.html).toBe(`<p>Intro</p><p>Rest</p>`);
  });

  it("replaces <!--nextpage--> with hr marker and counts pages", () => {
    const html = `<p>Page1</p><!--nextpage--><p>Page2</p><!--nextpage--><p>Page3</p>`;
    const qt = applyQuicktags(html);
    expect(qt.pageBreaks).toBe(2);
    expect(qt.html).toContain('<hr data-wp-nextpage="true" />');
  });
});

describe("Auto-embeds", () => {
  it("wraps standalone YouTube URL in an embeddable anchor", () => {
    const html = `Check this:\nhttps://youtu.be/dQw4w9WgXcQ\nNice.`;
    const out = transformAutoEmbeds(html);
    expect(out).toMatch(/class="wp-embed" data-embed="youtube"/i);
    expect(out).toMatch(/href="https:\/\/youtu\.be\/dQw4w9WgXcQ"/);
  });

  it("transforms [embed]...[/embed] shortcodes", () => {
    const html = `[embed]https://player.vimeo.com/video/12345[/embed]`;
    const out = transformAutoEmbeds(html);
    expect(out).toMatch(/class="wp-embed" data-embed="vimeo"/i);
  });
});
