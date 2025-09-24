# REQ_WYSIWYG — Rich Text Editor Requirements
**Project:** Narravo Blog Platform  
**File:** `REQ_WYSIWYG.md`  
**Authoring date:** 2025-09-24  
**Target component:** `TiptapEditor.tsx` (TipTap-based editor)

## Summary
We need a robust, accessible, and secure WYSIWYG editor for authoring blog posts. This editor must support:
- **Object alignment** (left, center, right) for paragraphs, headings, images, and embeds.
- **Code blocks with explicit language selection** and syntax highlighting.
- Modern authoring essentials (links, lists, images, tables, quotes, separators, inline code, undo/redo).
- Clean **Markdown ↔︎ Editor** round‑trip (fenced code blocks with language tags).
- **Paste handling**, **sanitization**, **a11y**, **theming**, and **performance** best practices.

The current implementation uses TipTap with `StarterKit`, `Image`, and `tiptap-markdown`. These requirements expand functionality while keeping Markdown as the storage format.

---

## Goals & Non‑Goals
### Goals
1. Provide a first‑class writing experience with keyboard shortcuts and a minimal, modern toolbar.
2. Allow setting **text alignment** for blocks and **alignment for images/embeds**.
3. Allow **code block language** selection; auto‑detect on paste; persist as fenced code in Markdown.
4. Preserve content fidelity across editor sessions (**idempotent** Markdown import/export).
5. Enforce **security** (sanitization) and **accessibility** (keyboardable toolbar, ARIA, alt text).
6. Enable **responsive images** and captions; keep upload flow compatible with existing presign API.
7. Ensure **extensibility** (tables, task lists, callouts) without compromising performance.
8. Enable **resizing images**; be able to resize images within the editor.
9. 
### Non‑Goals
- Real‑time multi‑user collaboration (out of scope for this iteration).
- Arbitrary third‑party embeds beyond a small, whitelisted set.
- Custom Markdown dialect beyond minimal HTML for image alignment (see below).

---

## Functional Requirements

### 1) Block & Object Alignment
- **Text/Headings**: Support left, center, right alignment using TipTap **TextAlign** extension (types: `paragraph`, `heading`).
- **Images**: Extend the `Image` node with an `align` attribute (`left` | `center` | `right`) and `width` (`auto` | percentage | px).
  - Render HTML with classes: `img-align-left|center|right`.
  - **Markdown export**: use HTML fallback for alignment:
    ```html
    <figure class="align-center">
      <img src="/path" alt="..." />
      <figcaption>Optional caption</figcaption>
    </figure>
    ```
  - **Markdown import**: detect `<figure class="align-...">` and map back to `Image` node attributes.
- **Embeds** (optional/phase 2): same alignment model as images.

**Toolbar**: three toggle buttons (Left, Center, Right) apply to current block or selected image.

### 2) Code Blocks & Languages
- Use **@tiptap/extension-code-block-lowlight** with **lowlight** (highlight.js grammars).
- Register popular languages (tsx, typescript, javascript, bash, json, yaml, python, go, rust, csharp, html, css, sql, markdown).
- **UI**: When cursor is in a code block, show a small **language dropdown** (with search + “Plain text” option).
- **Paste handling**:
  - If triple‑backtick fenced text is pasted, parse language from the fence (```ts, ```bash, etc.).
  - If unannotated code is pasted, **auto‑detect** language and preselect, but allow manual override.
- **Markdown export**: **fenced code** style with language token (e.g., ```ts).
- **Markdown import**: parse fenced code and set `language` attribute on the node.

### 3) Core Editing Features
Minimum toolbar groups (with keyboard shortcuts):
- **Formatting**: Bold (**Ctrl/Cmd+B**), Italic (**Ctrl/Cmd+I**), Inline code (``Ctrl/Cmd+` ``), Underline (optional).
- **Blocks**: H1–H3, paragraph, blockquote, horizontal rule.
- **Lists**: bullet, ordered, task list (checklist).
- **Insert**: image (upload or URL), table (2×2 default), code block.
- **Link**: add/edit/remove link with target toggle; sanitize `javascript:` and set `rel="noopener noreferrer"` on external links.
- **History**: Undo/redo.
- **Clear**: Clear formatting (selection only).

### 4) Images & Uploads
- Reuse the **existing presigned upload** flow already present in `TiptapEditor.tsx`.
- On insert:
  - Prompt for **alt text** (required), optional **caption**.
  - Allow setting **width** (percentage) and **alignment**.
- Render images **lazy‑loaded** with `loading="lazy"`.
- Enforce limits: max file size (configurable), allowed MIME types (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), and max dimensions (client‑side warning).
- Store image metadata in node attributes; keep source URL immutable once uploaded.

### 5) Tables (MVP)
- Basic insert/delete table, add/remove row/column, merge cells (optional).
- Keyboard navigation; ensure Markdown export falls back to HTML table (supported by most Markdown renderers).
- Import HTML tables back into table nodes when possible.

### 6) Paste & Drop Handling
- Sanitize pasted HTML using DOMPurify‑like policy:
  - Allowed tags: p, h1–h3, strong, em, code, pre, blockquote, ul/ol/li, hr, a, img, table/thead/tbody/tr/td/th, figure/figcaption.
  - Strip scripts/event handlers/styles; keep `href`, `src`, `alt`, `title`, `rel`, `target`, data attributes for nodes.
- Smart paste:
  - Convert triple‑backtick fences to code blocks with language.
  - Convert plain URL to link (linkify) if not inside code.
  - Image paste/upload should respect limits and prompt for alt text/caption.

### 7) Accessibility (A11y)
- Toolbar and menus keyboard‑navigable; visible focus styles; ARIA labels for controls.
- Heading hierarchy guidance (discourage skipping from H1→H3).
- **Alt text required** for images (caption optional).
- Color contrast meets WCAG AA; consider high‑contrast mode.
- Screen‑reader announcements for state changes (e.g., “Code block language set to TypeScript”).

### 8) Theming & UX
- Support **dark/light mode**; icons with sufficient contrast.
- Minimal, uncluttered toolbar with tooltips + shortcuts.
- Bubble/floating menus for context actions (links, code, images).
- Resizable editor height; placeholder text when empty.

### 9) Performance
- Debounced `onChange` (e.g., 300ms) and **throttled** heavy operations.
- **Dynamic import** of lowlight grammars (split by language) to keep bundle small.
- Reuse the editor instance; avoid re‑mount churn; memoize toolbars.
- Large‑doc test: target smooth typing up to 50–100k chars.

### 10) Security
- DOM sanitization on paste/drop; encode HTML entities in Markdown where needed.
- Disallow iframes by default (opt‑in allowlist in config).
- Links: add `rel="nofollow ugc"` for user content if needed.
- Enforce content length limits; reject disallowed tags at import.

### 11) Persistence & Serialization
- Primary storage format: **Markdown** via `tiptap-markdown` with:
  - `codeBlockStyle: "fence"`
  - HTML enabled to represent figures/tables where Markdown is insufficient.
- Round‑trip tests: Import Markdown → Edit → Export Markdown, differences limited to whitespace/formatting.
- Provide `fromMarkdown(markdown)` and `toMarkdown(editor)` helpers with stable options.

### 12) Testing & QA
- Unit tests:
  - Markdown import/export of code blocks with language.
  - Alignment set/get for paragraphs and images.
  - Link sanitization & attributes.
- E2E tests (Playwright):
  - Toolbar actions, keyboard shortcuts, paste scenarios, image upload prompts.
  - Dark/light theming visual checks.
- Performance budgets: initial editor load < 150KB gz (excluding dynamic language packs).

### 13) Telemetry (Optional)
- Count feature usage (code block, align, tables) with a privacy‑respecting event system.
- Measure editor init time and Markdown round‑trip cost.

---

## Implementation Notes (TipTap)
- Install:  
  `@tiptap/react @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-link @tiptap/extension-code-block-lowlight lowlight highlight.js @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/extension-table @tiptap/extension-image`
- Configure TextAlign: `TextAlign.configure({ types: ['heading','paragraph'] })`
- CodeBlockLowlight: `CodeBlockLowlight.configure({ lowlight })` and dynamically register languages.
- Image extension: extend `Image` with attributes `align`, `width`, `title`, `caption`; add `align-*` classes in renderHTML.
- Markdown: use `Markdown.configure({ html: true, codeBlockStyle: 'fence' })` and add custom serializer for figure alignment if needed.
- Sanitization: run DOMPurify (or similar) prior to `editor.commands.setContent` or in paste handler.

---

## Acceptance Criteria (AC)
1. User can select **Left/Center/Right** for paragraphs and headings; alignment persists after reload.
2. User can align an **image** (left/center/right), set width, alt text, optional caption; alignment persists after reload.
3. Creating a code block exposes a **language dropdown**; exported Markdown uses fenced code with that language.
4. Pasting ```ts code results in a TypeScript code block with highlighting.
5. Paste HTML from Word/Google Docs produces clean content (sanitized, semantically reasonable).
6. Links are sanitized and safe; external links gain `rel="noopener noreferrer"` by default.
7. Round‑trip Markdown import/export retains structure (lists, code blocks with language, headings, alignment via figure HTML).
8. All toolbar actions are keyboard accessible with ARIA labels and tooltips.
9. Editor loads quickly; dynamic language loading works (JS grammar not loaded until selected/encountered).

---

## Rollout Plan
- Phase 1 (MVP): Alignment (text+images), code block languages, core toolbar, paste sanitization, Markdown round‑trip.
- Phase 2: Tables, task list, callouts, embed allowlist, telemetry.
- Phase 3: Collaboration mode, multi‑cursor, advanced embeds.
