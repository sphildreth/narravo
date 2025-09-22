# Markdown to HTML Rendering

This document describes the implementation of secure markdown-to-HTML rendering in Narravo, as specified in `@docs/REQ_MARKDOWN_TO_HTML.md`.

## Overview

Narravo now supports markdown content for both posts and comments, with server-side rendering and sanitization to prevent XSS attacks. Content is stored in two formats:

- **Raw Markdown** (`body_md` column): The original content for editing
- **Rendered HTML** (`body_html` column): Pre-rendered and sanitized HTML for display

## Implementation

### Database Schema

**Posts Table:**
```sql
ALTER TABLE "posts" ADD COLUMN "body_md" text;
ALTER TABLE "posts" ADD COLUMN "body_html" text;
```

The `body_html` column is populated from the legacy `html` column during migration.

**Comments Table:**
No changes needed - already has `body_md` and `body_html` columns.

### Core Libraries

#### `lib/markdown.ts`

Main markdown processing functions:

- `markdownToHtmlSync(markdown: string): string` - Synchronous conversion
- `markdownToHtml(markdown: string): Promise<string>` - Async conversion  
- `extractExcerpt(markdown: string, maxLength?: number): string` - Extract plain text excerpt
- `isMarkdown(content: string): boolean` - Detect markdown content

#### `lib/sanitize.ts`

Updated sanitization functions:

- `sanitizeHtml(html: string): string` - General HTML sanitization
- `sanitizeCommentHtml(html: string): string` - More restrictive for comments

### Processing Flow

1. **Input**: User submits markdown content
2. **Conversion**: Markdown converted to HTML using `marked` library
3. **Post-processing**: External links get security attributes
4. **Sanitization**: HTML cleaned using DOMPurify with allowlist
5. **Storage**: Both markdown and sanitized HTML stored in database
6. **Display**: Pre-rendered HTML served to users

### Security Features

- **XSS Prevention**: All HTML is sanitized server-side
- **External Link Safety**: Automatic `target="_blank" rel="noopener noreferrer"`
- **Allowlist Approach**: Only specific HTML tags and attributes allowed
- **Input Validation**: Dangerous protocols and scripts blocked

### Allowed HTML Elements

**Posts:** `p`, `a`, `strong`, `em`, `code`, `pre`, `ul`, `ol`, `li`, `blockquote`, `img`, `br`, `span`, `h1-h6`

**Comments:** `p`, `a`, `strong`, `em`, `code`, `ul`, `ol`, `li`, `blockquote`, `br` (no images or headers)

### Usage Examples

#### Creating a Post with Markdown

```typescript
import { createPost } from '@/lib/posts';

const post = await createPost({
  title: "My Post",
  slug: "my-post", 
  bodyMd: "# Hello\n\nThis is **bold** text.",
  publishedAt: new Date()
});
```

#### Processing Comments

```typescript
import { sanitizeMarkdown } from '@/lib/comments';

const safeHtml = sanitizeMarkdown("This is *italic* text with [link](https://example.com)");
```

## Testing

Comprehensive tests cover:

- Markdown-to-HTML conversion
- XSS attack prevention  
- External link processing
- Excerpt extraction
- Sanitization edge cases

Run tests: `pnpm test tests/markdown.test.ts tests/sanitize.test.ts`

## Migration

Existing content is preserved during migration:
1. `body_md` column added (nullable)
2. `body_html` column added and populated from existing `html` content
3. Legacy `html` column maintained for backward compatibility

New content should use the markdown workflow, while legacy content continues to work.