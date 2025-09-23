// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";

function transformAvShortcodes(html: string): string {
  if (!html) return html;
  html = html.replace(/\[audio\b([^\]]*)\]/gi, (_m, attrs) => {
    const src = (attrs.match(/src="([^"]+)"/i)?.[1]) || "";
    const preload = attrs.match(/preload="(auto|metadata|none)"/i)?.[1];
    const loop = /(?:^|\s)loop(?:\s|$|=|")/i.test(attrs);
    const autoplay = /(?:^|\s)autoplay(?:\s|$|=|")/i.test(attrs);
    const meta = [
      src ? `data-src="${src.replace(/"/g, "&quot;")}"` : "",
      preload ? `data-preload="${preload}"` : "",
      loop ? `data-loop="true"` : "",
      autoplay ? `data-autoplay="true"` : ""
    ].filter(Boolean).join(" ");
    return `<div class="wp-audio"${meta ? " " + meta : ""}></div>`;
  });
  html = html.replace(/\[video\b([^\]]*)\]/gi, (_m, attrs) => {
    const src = (attrs.match(/src="([^"]+)"/i)?.[1]) || "";
    const poster = (attrs.match(/poster="([^"]+)"/i)?.[1]) || "";
    const width = (attrs.match(/width="(\d+)"/i)?.[1]) || "";
    const height = (attrs.match(/height="(\d+)"/i)?.[1]) || "";
    const preload = attrs.match(/preload="(auto|metadata|none)"/i)?.[1];
    const loop = /(?:^|\s)loop(?:\s|$|=|")/i.test(attrs);
    const autoplay = /(?:^|\s)autoplay(?:\s|$|=|")/i.test(attrs);
    const meta = [
      src ? `data-src="${src.replace(/"/g, "&quot;")}"` : "",
      poster ? `data-poster="${poster.replace(/"/g, "&quot;")}"` : "",
      width ? `data-width="${width}"` : "",
      height ? `data-height="${height}"` : "",
      preload ? `data-preload="${preload}"` : "",
      loop ? `data-loop="true"` : "",
      autoplay ? `data-autoplay="true"` : ""
    ].filter(Boolean).join(" ");
    return `<div class="wp-video"${meta ? " " + meta : ""}></div>`;
  });
  html = html.replace(/\[playlist\b([^\]]*)\]/gi, (_m, attrs) => {
    const ids = (attrs.match(/ids="([^"]+)"/i)?.[1] || "")
      .split(",").map((s: string) => s.trim()).filter(Boolean);
    const type = (attrs.match(/type="(audio|video)"/i)?.[1]) || "audio";
    const meta = [
      ids.length ? `data-ids="${ids.join(",")}"` : "",
      `data-type="${type}"`
    ].filter(Boolean).join(" ");
    return `<div class="wp-playlist"${meta ? " " + meta : ""}></div>`;
  });
  return html;
}

function transformCoreBlocks(html: string): string {
  if (!html) return html;
  return html.replace(/<!--\s*wp:([a-z\/-]+)(\s+(\{[\s\S]*?\}))?\s*-->([\s\S]*?)<!--\s*\/wp:\1\s*-->/gi,
    (_m, type, _jsonAll, jsonStr, inner) => {
      const json = (() => { try { return jsonStr ? JSON.parse(jsonStr) : {}; } catch { return {}; } })();
      const t = String(type).toLowerCase();
      if (t === "image") {
        const id = json?.id ?? json?.attachmentId;
        const size = json?.sizeSlug || json?.size;
        const meta = [id ? `data-id="${id}"` : "", size ? `data-size="${size}"` : ""].filter(Boolean).join(" ");
        return `<figure class="wp-image"${meta ? " " + meta : ""}>${inner}</figure>`;
      }
      if (t === "embed") {
        const url = json?.url || inner.trim();
        if (!url) return inner;
        let provider: string | null = null;
        if (/youtube\.com|youtu\.be/i.test(url)) provider = "youtube";
        else if (/vimeo\.com/i.test(url)) provider = "vimeo";
        else if (/soundcloud\.com|w\.soundcloud\.com/i.test(url)) provider = "soundcloud";
        const escaped = String(url).replace(/"/g, "&quot;");
        if (provider) return `<p><a class="wp-embed" data-embed="${provider}" href="${escaped}">${escaped}</a></p>`;
        return `<p><a class="wp-embed" href="${escaped}">${escaped}</a></p>`;
      }
      if (t === "gallery") {
        const ids = Array.isArray(json?.ids) ? json.ids : [];
        const columns = json?.columns;
        const meta = [ids.length ? `data-wp-gallery-ids="${ids.join(",")}"` : "", columns ? `data-wp-gallery-columns="${columns}"` : ""].filter(Boolean).join(" ");
        return `<div class="wp-gallery-placeholder"${meta ? " " + meta : ""}></div>`;
      }
      return inner;
    }
  );
}

function resolveInternalLinks(html: string, postIdToSlug: Record<string, string>, attachmentIdToUrl: Record<string, string>): string {
  if (!html) return html;
  html = html.replace(/<a([^>]+)data-wp-post-id="(\d+)"([^>]*)>/gi, (m, pre, id, post) => {
    const slug = postIdToSlug[String(id)];
    if (!slug) return m;
    return `<a${pre}href="/posts/${slug}"${post}>`;
  });
  html = html.replace(/<a([^>]+)data-wp-attachment-id="(\d+)"([^>]*)>/gi, (m, pre, id, post) => {
    const url = attachmentIdToUrl[String(id)];
    if (!url) return m;
    return `<a${pre}href="${url}"${post}>`;
  });
  return html;
}

describe("AV shortcodes", () => {
  it("handles [audio] and [video] attrs", () => {
    const outA = transformAvShortcodes(`[audio src="https://ex.com/a.mp3" preload="metadata" loop autoplay]`);
    expect(outA).toMatch(/class="wp-audio"/);
    expect(outA).toMatch(/data-src="https:\/\/ex\.com\/a\.mp3"/);
    expect(outA).toMatch(/data-preload="metadata"/);
    expect(outA).toMatch(/data-loop="true"/);
    expect(outA).toMatch(/data-autoplay="true"/);

    const outV = transformAvShortcodes(`[video src="https://ex.com/v.mp4" poster="https://ex.com/p.jpg" width="640" height="360"]`);
    expect(outV).toMatch(/class="wp-video"/);
    expect(outV).toMatch(/data-src="https:\/\/ex\.com\/v\.mp4"/);
    expect(outV).toMatch(/data-poster="https:\/\/ex\.com\/p\.jpg"/);
    expect(outV).toMatch(/data-width="640"/);
    expect(outV).toMatch(/data-height="360"/);
  });

  it("handles [playlist] ids and type", () => {
    const out = transformAvShortcodes(`[playlist ids="1, 2,3" type="video"]`);
    expect(out).toMatch(/class="wp-playlist"/);
    expect(out).toMatch(/data-ids="1,2,3"/);
    expect(out).toMatch(/data-type="video"/);
  });
});

describe("Core block parsing", () => {
  it("parses wp:image and carries inner HTML", () => {
    const html = `<!-- wp:image {"id":42,"sizeSlug":"large"} --><img src="/x.jpg" alt="x"/><!-- /wp:image -->`;
    const out = transformCoreBlocks(html);
    expect(out).toMatch(/figure class="wp-image"/i);
    expect(out).toMatch(/data-id="42"/);
    expect(out).toMatch(/data-size="large"/);
    expect(out).toMatch(/<img src="\/x\.jpg"/);
  });

  it("parses wp:embed to embeddable anchor", () => {
    const html = `<!-- wp:embed {"url":"https://youtu.be/abc"} --><!-- /wp:embed -->`;
    const out = transformCoreBlocks(html);
    expect(out).toMatch(/class="wp-embed" data-embed="youtube"/i);
  });

  it("parses wp:gallery with ids", () => {
    const html = `<!-- wp:gallery {"ids":[1,2,3],"columns":3} --><!-- /wp:gallery -->`;
    const out = transformCoreBlocks(html);
    expect(out).toMatch(/class="wp-gallery-placeholder"/);
    expect(out).toMatch(/data-wp-gallery-ids="1,2,3"/);
    expect(out).toMatch(/data-wp-gallery-columns="3"/);
  });
});

describe("Post-save resolver", () => {
  it("replaces annotated post/attachment links with final URLs", () => {
    const html = `<a href="/?p=12" data-wp-post-id="12">post</a> and <a href="/?attachment_id=9" data-wp-attachment-id="9">att</a>`;
    const out = resolveInternalLinks(html, { "12":"hello-world" }, { "9":"https://cdn.ex/9.jpg" });
    expect(out).toContain('href="/posts/hello-world"');
    expect(out).toContain('href="https://cdn.ex/9.jpg"');
  });
});
