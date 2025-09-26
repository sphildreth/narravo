// SPDX-License-Identifier: Apache-2.0
import truncateHtml from "truncate-html";
import * as cheerio from "cheerio";

export type ExcerptOptions = {
  maxChars?: number; // default 220
  ellipsis?: string; // default "…"
  allowTags?: string[]; // default ["a","em","strong","code","span","b","i","u"]
  dropBlockCode?: boolean; // default true (drop <pre>)
};

const DEFAULTS: Required<ExcerptOptions> = {
  maxChars: 220,
  ellipsis: "…",
  allowTags: ["a", "em", "strong", "code", "span", "b", "i", "u"],
  dropBlockCode: true,
};

const MORE_RE = /<!--\s*more\s*-->/i;

export function hasMoreMarker(html: string): boolean {
  return MORE_RE.test(html ?? "");
}

export function extractBeforeMore(html: string): string {
  const s = html ?? "";
  const m = s.search(MORE_RE);
  return m >= 0 ? s.slice(0, m) : s;
}

/**
 * Remove unwanted/unsafe elements for excerpts while keeping inline formatting.
 * - Drops media and heavy/unsafe blocks entirely.
 * - Optionally drops <pre> blocks (block code), keeps inline <code>.
 * - Flattens blockquotes to plain paragraphs to avoid large nesting.
 */
export function stripUnwanted(html: string, opts?: ExcerptOptions): string {
  const o = { ...DEFAULTS, ...(opts || {}) } satisfies Required<ExcerptOptions>;
  const $ = cheerio.load(html ?? "", {});

  const drop =
    "img,video,audio,iframe,script,style,svg,canvas,form,noscript,object,embed,figure";
  $(drop).remove();

  if (o.dropBlockCode) {
    $("pre").remove();
  }

  // Convert blockquotes to simple paragraphs containing their text content
  $("blockquote").each((_, el) => {
    const txt = $(el).text();
    $(el).replaceWith($("<p>").text(txt));
  });

  // Remove empty paragraphs
  $("p").each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });

  // Optionally strip tags not in allowlist while keeping their text
  const allowed = new Set(o.allowTags.map((t) => t.toLowerCase()));
  $("*")
    .toArray()
    .forEach((el) => {
      const rawName = (el as any).tagName ?? (el as any).name;
      const name = typeof rawName === "string" ? rawName.toLowerCase() : undefined;
      if (!name) return;
      // keep common block containers but drop other unknowns by unwrapping
      const keepBlocks = new Set(["p", "span", "em", "strong", "b", "i", "u", "code", "a"]);
      if (!keepBlocks.has(name) && !allowed.has(name)) {
        $(el).replaceWith($(el).contents());
      }
    });

  return $.html();
}

export function visibleTextLength(html: string): number {
  const $ = cheerio.load(html ?? "");
  return $.text().replace(/\s+/g, " ").trim().length;
}

export function generateExcerpt(inputHtml: string, opts?: ExcerptOptions): string {
  const o = { ...DEFAULTS, ...(opts || {}) } satisfies Required<ExcerptOptions>;

  if (!inputHtml || typeof inputHtml !== "string") return "";

  const baseHtml = hasMoreMarker(inputHtml)
    ? extractBeforeMore(inputHtml)
    : inputHtml;

  const cleaned = stripUnwanted(baseHtml, o);

  // Choose a focus area: prefer the first meaningful paragraph (>= 30 visible chars)
  let focusHtml = cleaned;
  try {
    const $ = cheerio.load(cleaned);
    const paragraphs = $("p").toArray();
    const candidate = paragraphs.find((el) => {
      const len = $(el).text().replace(/\s+/g, " ").trim().length;
      return len >= 30;
    });
    if (candidate) {
      focusHtml = $.html(candidate);
    } else if (paragraphs[0]) {
      focusHtml = $.html(paragraphs[0]!);
    }
  } catch {
    // fall back to cleaned as-is
  }

  // Perform HTML-safe truncation; library ensures tags are not broken.
  const truncated = truncateHtml(focusHtml, {
    length: o.maxChars,
    ellipsis: o.ellipsis,
    reserveLastWord: true,
  });

  // Normalize whitespace post-truncation
  const normalized = truncated.replace(/\s+/g, " ").trim();

  // Too-short excerpts should be considered empty unless there was an explicit more marker
  const outLen = visibleTextLength(normalized);
  if (outLen < 30 && !hasMoreMarker(inputHtml)) return "";

  return normalized;
}
