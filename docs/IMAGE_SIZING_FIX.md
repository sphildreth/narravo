# Image Sizing & Alignment Fix

## Issues Resolved

### 1. Debug Log Cleanup
- Removed excessive `console.log` and `logger.debug` statements from TiptapEditor.tsx
- Kept only essential error logging (`console.error` for actual errors)
- Cleaned up fromMarkdown function logging

### 2. Image Attributes Not Persisting in Published Posts

**Problem**: Images displayed at full size in published posts, ignoring the size and alignment settings from the editor.

**Root Cause**: The `sanitizeHtml()` function in `src/lib/sanitize.ts` had `ALLOW_DATA_ATTR: false` and was stripping out the `data-width` and `data-align` attributes that store the image sizing information.

**Solution**: Updated the sanitizer configuration to explicitly allow these attributes.

## Changes Made

### File: `src/lib/sanitize.ts`

Added to `ALLOWED_ATTR` array:
```typescript
// Image styling attributes
"style"
```

Added to `ADD_ATTR` array:
```typescript
ADD_ATTR: ["data-mermaid", "data-width", "data-align"],
```

### File: `src/components/editor/TiptapEditor.tsx`

Cleaned up debug logging:
- Removed `logger.debug` calls from `fromMarkdown()`
- Removed `console.log` for content analysis
- Removed verbose logging from HTML/markdown processing

### File: `src/app/(admin)/admin/posts/actions.ts`

Fixed array parameter handling in `commitUploadsForPost()`:
- Changed from raw SQL `ANY()` to Drizzle's `inArray()` helper
- Added `inArray` import from `drizzle-orm`

## How Image Sizing Works

### In the Editor (TiptapEditor.tsx)

1. User selects an image → bubble menu appears
2. User chooses size (25%, 50%, 75%, 100%, Custom) and alignment (left, center, right)
3. `AlignedImage` extension applies:
   - `style="width: 50%"` - actual CSS width
   - `data-width="50%"` - stored for serialization
   - `class="img-align-center"` - alignment class
   - `data-align="center"` - stored for serialization

### During Save (actions.ts)

4. TipTap serializes to HTML with all attributes via `addStorage().markdown.serialize()`
5. HTML goes through `markdownToHtmlSync()` → `sanitizeHtml()`
6. **NOW**: Sanitizer preserves `data-width`, `data-align`, `style`, and `class`
7. Saved to database as `bodyHtml`

### During Display (Prose.tsx)

8. Post HTML is rendered via `<Prose html={post.bodyHtml} />`
9. `Prose` component parses images and extracts attributes:
   - `data-width` → applied as inline style
   - `data-align` → added as `img-align-{value}` class
10. CSS applies alignment: `.img-align-center { display: block; margin: 0 auto; }`
11. Images display with correct size and alignment

## Testing

### To Verify the Fix:

1. **Edit an existing post** in the admin panel
2. **Insert or select an image** 
3. **Use the bubble menu** to set:
   - Size: 50%
   - Alignment: Center
4. **Save the post**
5. **View the published post** - image should be 50% width and centered

### What to Check:

- ✅ Bubble menu appears when clicking images in editor
- ✅ Size and alignment changes work in editor preview
- ✅ After saving, revisiting editor shows correct settings
- ✅ Published post displays images at correct size
- ✅ Published post displays images with correct alignment
- ✅ Click-to-zoom lightbox still works

## Important Notes

### Re-saving Required

**If you have existing posts with sized/aligned images that aren't displaying correctly:**

You must **re-save those posts** after this fix. The sanitizer was stripping the attributes during the initial save, so they don't exist in the database. Simply:

1. Open the post in the editor
2. Click "Save" (no changes needed)
3. The post will be re-saved with the attributes preserved

### Browser Cache

If you've recently viewed a post, your browser may have cached the old HTML. Try:
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or clear browser cache

### Data Attributes Are Safe

The `data-*` attributes are HTML5 standard and completely safe:
- They don't execute code
- They're designed for storing custom data
- Widely used in modern web applications
- Only explicitly whitelisted attributes are allowed

## Related Files

- **Editor**: `/src/components/editor/TiptapEditor.tsx` - Image bubble menu and serialization
- **Sanitizer**: `/src/lib/sanitize.ts` - HTML sanitization with attribute whitelist
- **Display**: `/src/components/Prose.tsx` - Parses and applies image attributes
- **Actions**: `/src/app/(admin)/admin/posts/actions.ts` - Save operations
- **Styles**: `/src/app/globals.css` - Image alignment CSS classes

## Future Enhancements

Consider these improvements for the image sizing feature:

1. **Visual Drag Handles**: Add drag-to-resize handles on images
2. **Aspect Ratio Lock**: Maintain proportions during resize
3. **Preset Dimensions**: Common sizes like "thumbnail", "medium", "large"
4. **Responsive Breakpoints**: Different sizes for mobile/tablet/desktop
5. **Server-side Resizing**: Generate multiple image sizes on upload (sharp/libvips)
6. **Image Optimization**: Automatic WebP/AVIF conversion

## Troubleshooting

### Images still showing full size after fix:

1. **Did you re-save the post?** Old posts need to be re-saved
2. **Check browser cache**: Hard refresh the page
3. **Verify the HTML**: View page source and check for `data-width` and `data-align` attributes
4. **Check CSS**: Ensure `img-align-*` classes are in globals.css

### Bubble menu not appearing:

1. **Click the image** to select it (don't just hover)
2. **Check console** for JavaScript errors
3. **Verify editor state**: `imageSelected` should be true when image is selected

### Attributes being stripped:

1. **Verify sanitize.ts**: Check that `ADD_ATTR` includes the data attributes
2. **Check server restart**: Changes to server files require restart
3. **Clear any CDN/proxy cache**: If using Cloudflare, etc.
