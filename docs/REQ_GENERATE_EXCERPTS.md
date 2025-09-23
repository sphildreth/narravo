# Coding Agent Prompt: Implement HTML‑Safe Post Excerpts During Import

## Objective
Implement a **fast, deterministic, HTML‑safe “excerpt”** generator that populates/updates the `excerpt` column for each blog post **during import** (no LLMs). The excerpt is a short teaser used under cards/list items. It must **not break HTML**, avoid images/iframes, and respect an optional `<!--more-->` marker when present.

---

## Context (Project: Narravo)
- Tech stack: TypeScript/Node.js (Next.js repo with import scripts).
- Source content: WordPress WXR or HTML/MD content already normalized to HTML during import.
- Destination: Database table `posts` with columns including `id`, `slug`, `title`, `html`, `excerpt`, `created_at`, `updated_at`.
- Importer: Existing import pipeline/script (TS/Node) that reads records and writes to DB.

---

## High‑Level Requirements
1. **Deterministic Excerpt**  
   - Prefer the portion **before the first `<!--more-->` marker**, if present.
   - Else: take the **first meaningful paragraph(s)** and **truncate by characters** with HTML preserved.
2. **HTML‑Safe Truncation**  
   - Do **not** break tags; ensure valid HTML is output.
   - Strip or ignore the following from excerpts: `img`, `video`, `audio`, `iframe`, `script`, `style`, `svg`, `canvas`, `form`.
   - Inline code (`<code>`) is allowed; block code (`<pre>`) is excluded by default.
3. **Length Controls**  
   - Default **maxChars**: `220` (configurable).  
   - Add ellipsis `…` only if truncated.
4. **Whitespace/Entities**  
   - Collapse consecutive whitespace.  
   - Preserve basic inline formatting (`<em>`, `<strong>`, `<a>`, `<code>`).  
   - Preserve entities (`&amp;`, `&nbsp;`, etc.).
5. **Safety & Robustness**  
   - Handle empty/invalid HTML gracefully—return empty string for `excerpt` and log a warning.
   - Treat excerpts shorter than 30 visible chars as **empty** unless a `<!--more-->` section exists.
6. **Idempotent Import**  
   - During re‑imports, recompute excerpt if `html` changed or if `excerpt` is null/empty; otherwise leave as is (unless a `--rebuild-excerpts` flag is set).

---

## Libraries (Choose One; server‑side import)
- **Option A:** `truncate-html` (Node + Cheerio) for HTML‑aware truncation.
- **Option B:** `html-truncate` for DOM‑less HTML truncation.
- Either option is acceptable; prefer **A** when Cheerio is already in the pipeline.

> You MUST vendor‑lock the API behind our own `ExcerptService` so we can swap libraries without touching calling code.

---

## Deliverables
1. `src/lib/excerpts/ExcerptService.ts` with:
   - `generateExcerpt(html: string, opts?: ExcerptOptions): string`
   - `hasMoreMarker(html: string): boolean`
   - `extractBeforeMore(html: string): string`
   - `stripUnwanted(html: string): string` (removes disallowed tags)
   - `visibleTextLength(html: string): number` (utility to decide “too short”)
   - Types: `ExcerptOptions` (below)
2. Import‑pipeline integration (e.g., `scripts/import-wxr.ts` and/or `src/lib/importers/...`) to populate `excerpt` before DB write.
3. Config:
   - `EXCERPT_MAX_CHARS` (default 220)
   - `EXCERPT_ELLIPSIS` (default `…`)
   - `EXCERPT_INCLUDE_BLOCK_CODE` (default `false`)
   - `EXCERPT_REBUILD` (CLI flag `--rebuild-excerpts`)
4. Unit tests: `src/lib/excerpts/__tests__/ExcerptService.test.ts`
5. Migration note (if needed) is **not** required; we are writing into existing `excerpt` column.

---

## API Contract
```ts
export type ExcerptOptions = {
  maxChars?: number;         // default 220
  ellipsis?: string;         // default "…"
  allowTags?: string[];      // default ["a","em","strong","code","span","b","i","u"]
  dropBlockCode?: boolean;   // default true (drop <pre>)
};

export function generateExcerpt(html: string, opts?: ExcerptOptions): string;
export function hasMoreMarker(html: string): boolean;
export function extractBeforeMore(html: string): string;
export function stripUnwanted(html: string, opts?: ExcerptOptions): string;
export function visibleTextLength(html: string): number;
```

---

## Implementation Steps

### Step 1 — Utility: `hasMoreMarker`/`extractBeforeMore`
- Detect `<!--more-->` (case‑insensitive).  
- `extractBeforeMore` returns HTML up to but **excluding** the marker; if the marker is first content and empty, fall back to Step 2.

### Step 2 — Strip unwanted tags
- Remove disallowed elements entirely (`img`, `video`, `audio`, `iframe`, `script`, `style`, `svg`, `canvas`, `form`, `noscript`, `object`, `embed`, `figure`).
- If `dropBlockCode` is true, drop `<pre>` blocks. Keep inline code.

### Step 3 — Identify first meaningful paragraph(s)
- Parse with Cheerio (if using `truncate-html`) or use regex‑lite heuristics when using `html-truncate`.
- Candidate nodes: first `<p>` with visible text length ≥ 30, or the first sequence of inline text outside of headers.
- If none found, use entire HTML after stripping.

### Step 4 — Truncate with HTML safety
- Use the chosen library to truncate to `maxChars` and append `ellipsis` only when actual truncation occurred.
- Collapse whitespace (e.g., regex `\s+` → single space) **after** truncation, but do not remove needed tag spacing.

### Step 5 — Wiring into import
- In the import loop, after HTML normalization but before DB write:
  - If `--rebuild-excerpts` or `!post.excerpt` or `htmlChangedSinceLastImport` → recompute via `generateExcerpt`.
  - Save to `post.excerpt`.

---

## Reference Implementation (TypeScript, `truncate-html`)
```ts
// src/lib/excerpts/ExcerptService.ts
import truncateHtml from "truncate-html";
import * as cheerio from "cheerio";

export type ExcerptOptions = {
  maxChars?: number;
  ellipsis?: string;
  allowTags?: string[];
  dropBlockCode?: boolean;
};

const DEFAULTS: Required<ExcerptOptions> = {
  maxChars: 220,
  ellipsis: "…",
  allowTags: ["a", "em", "strong", "code", "span", "b", "i", "u"],
  dropBlockCode: true,
};

export function hasMoreMarker(html: string): boolean {
  return /<!--\s*more\s*-->/i.test(html ?? "");
}

export function extractBeforeMore(html: string): string {
  const idx = (html ?? "").search(/<!--\s*more\s*-->/i);
  return idx >= 0 ? html.slice(0, idx) : html;
}

export function stripUnwanted(html: string, opts?: ExcerptOptions): string {
  const $ = cheerio.load(html ?? "", { decodeEntities: true });

  const drop = "img,video,audio,iframe,script,style,svg,canvas,form,noscript,object,embed,figure";
  $(drop).remove();

  if (opts?.dropBlockCode ?? DEFAULTS.dropBlockCode) {
    $("pre").remove();
  }

  // Optional: demote blockquotes (convert to plain text)
  $("blockquote").each((_, el) => {
    const text = $(el).text();
    $(el).replaceWith($("<p>").text(text));
  });

  // Trim empty paragraphs
  $("p").each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });

  return $.html();
}

export function visibleTextLength(html: string): number {
  const $ = cheerio.load(html ?? "");
  return $.text().replace(/\s+/g, " ").trim().length;
}

export function generateExcerpt(inputHtml: string, opts?: ExcerptOptions): string {
  const o = { ...DEFAULTS, ...(opts || {}) };

  if (!inputHtml || typeof inputHtml !== "string") return "";

  const baseHtml = hasMoreMarker(inputHtml)
    ? extractBeforeMore(inputHtml)
    : inputHtml;

  const cleaned = stripUnwanted(baseHtml, o);

  // Find first meaningful paragraph if overall content is long
  let focusHtml = cleaned;
  try {
    const $ = cheerio.load(cleaned);
    const candidates = $("p").toArray();
    const firstMeaningful = candidates.find((el) => {
      const len = $(el).text().replace(/\s+/g, " ").trim().length;
      return len >= 30;
    });
    if (firstMeaningful) {
      focusHtml = $.html(firstMeaningful);
    }
  } catch {
    // ignore; fallback to cleaned
  }

  // Truncate while preserving allowed tags
  const truncated = truncateHtml(focusHtml, {
    length: o.maxChars,
    ellipsis: o.ellipsis,
    // allowTags controls which tags survive; others are stripped
    // Note: truncate-html accepts allowTags inside options in some forks;
    // if not supported, pre-strip using cheerio above already enforces safety.
    reserveLastWord: true,
  });

  const normalized = truncated.replace(/\s+/g, " ").trim();
  const baseLen = visibleTextLength(focusHtml);
  const outLen = visibleTextLength(normalized);

  // If excerpt is too short and there IS a more marker, keep as-is.
  if (outLen < 30 && !hasMoreMarker(inputHtml)) return "";

  // Append ellipsis only if we actually truncated meaningful text
  const actuallyTruncated = outLen < baseLen and outLen >= o.maxChars - 5  # noqa
  return normalized;
}
```

---

## Import Pipeline Hook (example)
```ts
// scripts/import-wxr.ts (excerpt)
import { generateExcerpt } from "../src/lib/excerpts/ExcerptService";
const MAX = Number(process.env.EXCERPT_MAX_CHARS ?? 220);

for (const post of posts) {
  const html = post.html ?? "";
  const needs = argv.rebuildExcerpts || !post.excerpt || post.htmlChangedSinceLastImport;

  if (needs) {
    post.excerpt = generateExcerpt(html, { maxChars: MAX });
  }

  await upsertPost(post); // existing persistence
}
```

---

## Tests (Jest)
```ts
// src/lib/excerpts/__tests__/ExcerptService.test.ts
import { generateExcerpt, hasMoreMarker, extractBeforeMore, visibleTextLength } from "../ExcerptService";

test("respects <!--more--> marker", () => {
  const html = "<p>Intro</p><!--more--><p>Body</p>";
  expect(hasMoreMarker(html)).toBe(true);
  expect(extractBeforeMore(html)).toContain("Intro");
  expect(extractBeforeMore(html)).not.toContain("Body");
});

test("drops media and iframes", () => {
  const html = '<p>Text</p><img src="x"><iframe src="y"></iframe>';
  const out = generateExcerpt(html, { maxChars: 50 });
  expect(out).toMatch(/Text/);
  expect(out).not.toMatch(/img|iframe/);
});

test("keeps inline formatting", () => {
  const html = "<p>Hello <strong>world</strong> and <code>x</code></p>";
  const out = generateExcerpt(html, { maxChars: 50 });
  expect(out).toMatch(/<strong>world<\/strong>/);
  expect(out).toMatch(/<code>x<\/code>/);
});

test("truncates with ellipsis when needed", () => {
  const html = "<p>" + "word ".repeat(200) + "</p>";
  const out = generateExcerpt(html, { maxChars: 120 });
  expect(visibleTextLength(out)).toBeLessThan(150);
  expect(out.endsWith("…") || out.includes("…")).toBeTruthy();
});
```
---

## CLI Flag
- Add `--rebuild-excerpts` to force recomputation for all rows.

---

## Acceptance Criteria
- Excerpts are **valid HTML** and render without broken tags.
- Excerpts never include media/iframes/scripts.
- `<!--more-->` strictly splits the teaser when present.
- Default output length ≈ 220 visible characters (configurable).
- Re‑running the importer is idempotent; unchanged posts keep their excerpt unless forced.
- Unit tests above pass.

---

## Stretch (Optional)
- Add per‑post override: if front‑matter/metadata contains `excerpt`, prefer it over computed.
- Add `wordBoundary: true` mode to avoid chopping the last word mid‑token when possible.
- Support Markdown sources by converting to HTML first (your pipeline may already do this).

---

## Done‑When
- Code merged behind `ExcerptService` with tests.
- Import job runs and populates the `excerpt` column for all posts.
- A sample of 20 imported posts visually inspected shows good one‑line teasers under cards/list items.
