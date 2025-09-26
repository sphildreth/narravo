# Narravo Kitchen Sink: Editor Feature Test

This post exercises the features currently supported by your editor: headings, inline styles, links, images (align/width/caption), **tables (TableKit)**, **task lists**, ordered/bulleted lists, code blocks (lowlight), blockquotes, horizontal rules, and your video shortcode.

> **Tip:** Paste this entire document into the editor or load via `initialMarkdown`. Unsupported HTML (iframes, audio, details, math, mermaid) is intentionally omitted.

---

## Text Styles & Headings

### H3: Inline Styles

- **Bold**, *italic*, <u>underline</u>, and ~~strikethrough~~.
- `inline code` for quick commands like `pnpm build` or `git status`.
- Smart quotes, dashes — and ellipses… should be handled by your renderer.

> Blockquote sample—great for notes, tips, or warnings.

---

## Links

- External: [OpenAI](https://openai.com)
- Email: <mailto:someone@example.com>
- Jump back to [Text Styles & Headings](#text-styles--headings).

---

## Images (Alignment, Width, Caption)

<figure class="align-center" data-width="80%">
  <img src="https://picsum.photos/seed/narravo-ks/1200/600" alt="Random scenic placeholder" title="Random scenic placeholder" />
  <figcaption><em>Figure:</em> Center-aligned image at ~80% width with a caption.</figcaption>
</figure>

> After insertion, try changing alignment (left/center/right) and width in your image controls.

---

## Lists (Bulleted & Numbered)

- Bullet one
  - Nested bullet
    - Third level
- Bullet two with *italic* and `code`

1. Step one
2. Step two
   1. Sub-step A
   2. Sub-step B
3. Step three

---

## Task Lists (with nesting)

- [x] Set up editor basics
- [x] Enable **TableKit**
- [x] Enable **TaskList** + **TaskItem**
- [ ] Add keyboard shortcuts for table ops
  - [x] Insert row above/below
  - [ ] Add column after (⌥→ or toolbar)
  - [ ] Toggle header row/column
- [ ] Review sanitizer allowlist
  - [ ] Consider safe oEmbed pathway for YouTube
  - [ ] Add domain allow-list for video sources

> Confirm that checkboxes are interactive in the editor (toggle on/off).

---

## Tables (TableKit)

Basic table with header row:

| Feature                | Status | Notes                           |
|------------------------|:------:|---------------------------------|
| Bold/Italic/Underline  |  ✅    | Inline styles                   |
| Code Blocks            |  ✅    | Lowlight/Prism config           |
| Task Lists             |  ✅    | `TaskList` + `TaskItem`         |
| Tables (TableKit)      |  ✅    | Insert rows/cols, header toggle |
| Images (align/width)   |  ✅    | Custom image node               |
| Video shortcode        |  ✅    | `[video mp4="..."][/video]`     |

Editable grid (try column/row ops):

| Operation       | Shortcut/Action         | Try It |
|-----------------|-------------------------|--------|
| Insert row below| Toolbar or context menu | ☐      |
| Insert column   | Toolbar or context menu | ☐      |
| Toggle header   | Toolbar                  | ☐      |
| Merge cells     | Toolbar (if enabled)     | ☐      |

> Use the toolbar/context menu to test insert/delete rows & columns, toggle header cells, and (if enabled) merge/split cells.

---

## Code Blocks (Language Hints)

```bash
# Shell
set -euo pipefail
echo "Hello from bash"
```

```json
{
  "name": "narravo",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

```tsx
// React/TSX
export default function Hello({ name = "World" }: { name?: string }) {
  return <h2>Hello, {name}!</h2>;
}
```

```sql
-- SQL
SELECT id, title FROM posts ORDER BY created_at DESC;
```

---

## Video (Shortcode, not iframe)

[video mp4="https://example.com/path/to/video.mp4"][/video]

> Use the **Video** button to insert; the editor will generate this shortcode automatically. Confirm playback in your renderer.

---

## Horizontal Rules

Above and below are horizontal rules:

---

## Quick Validation Checklist

- [ ] Headings, bold/italic/underline/strike render
- [ ] Links work (and anchor link jumps up)
- [ ] Image aligns center; width control works; caption visible
- [ ] Bullet and numbered lists render correctly
- [ ] Task list checkboxes toggle on/off, including nested items
- [ ] Tables: add/remove rows/columns; toggle header; (merge if enabled)
- [ ] Code blocks highlight by language
- [ ] Video shortcode renders in the front-end
- [ ] No sanitizer warnings in console

---

Happy testing!
