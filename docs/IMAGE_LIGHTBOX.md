# Image Lightbox Feature

## Overview

The Narravo blog platform now includes a click-to-zoom lightbox feature for images in published posts. This provides readers with an enhanced viewing experience for images without requiring server-side image resizing.

## Features

### For Readers (Published Posts)

- **Click to Zoom**: Click any image in a post to view it at full size in a lightbox overlay
- **Keyboard Navigation**: Press `Esc` to close the lightbox
- **Click Outside to Close**: Click anywhere outside the image to dismiss the lightbox
- **Smooth Animations**: Fade-in animation when opening the lightbox
- **Responsive**: Works on all screen sizes, with images constrained to 95% of viewport

### For Authors (Post Editor)

- **Resize Controls**: Select an image to see a floating bubble menu with size options:
  - Small (25%)
  - Medium (50%)
  - Large (75%)
  - Full (100%)
  - Custom (enter any pixel or percentage value)
  
- **Alignment Controls**: Align images left, center, or right

- **Preserved Settings**: Image sizes and alignment are saved with the post and rendered correctly when published

## Technical Implementation

### Image Attribute Persistence

The editor now properly serializes custom image attributes (width, alignment) to HTML:

```html
<img src="/uploads/image.jpg" 
     alt="Description" 
     style="width: 50%" 
     data-width="50%" 
     class="img-align-center" 
     data-align="center" />
```

These attributes are:
- Stored in the post's markdown/HTML
- Preserved through save/load cycles
- Applied when rendering published posts

### Lightbox Component

The `ImageWithLightbox` component wraps all images in published post content:

- **Client-side only**: Uses React portals to render at document.body level
- **Accessibility**: Includes proper ARIA labels and keyboard support
- **Styling**: Uses Tailwind CSS with theme-aware colors
- **Performance**: Images use lazy loading by default

### CSS Classes

Images support alignment classes:
- `.img-align-left` - Left-aligned (default)
- `.img-align-center` - Center-aligned with auto margins
- `.img-align-right` - Right-aligned

## Usage

### As an Author

1. **Insert an Image**: Click the Image button in the toolbar or paste/drag an image
2. **Enter Alt Text**: Provide descriptive alt text for accessibility
3. **Resize**: Click the image to show the bubble menu, then select a size
4. **Align**: Use the alignment buttons in the bubble menu
5. **Save**: Your size and alignment settings are preserved

### As a Reader

1. **View Post**: Images display at their configured size
2. **Zoom**: Click any image to view it at full size
3. **Close**: Press Esc or click outside the image

## Performance Considerations

### Current Approach

- **No server-side resizing**: Original uploaded images are served
- **Browser-side scaling**: CSS handles display sizing
- **Bandwidth**: Full-size images are downloaded regardless of display size

### Future Enhancements

Consider implementing:

1. **Responsive Image Generation**: Generate multiple sizes on upload (400w, 800w, 1200w, original)
2. **Srcset Attributes**: Use `<picture>` and `srcset` for responsive delivery
3. **Lazy Loading**: Already implemented for lightbox images
4. **Format Optimization**: Convert to WebP/AVIF for better compression

## Browser Support

- **Modern Browsers**: Full support in Chrome, Firefox, Safari, Edge
- **IE11**: Not supported (uses modern JavaScript features)
- **Mobile**: Full touch support on iOS and Android

## Accessibility

- **Alt Text**: Required for all images
- **Keyboard**: Full keyboard navigation support
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Focus Management**: Traps focus in lightbox when open

## File Locations

- **Lightbox Component**: `src/components/ImageLightbox.tsx`
- **Prose Component**: `src/components/Prose.tsx` (renders post content with lightbox)
- **Editor Extension**: `src/components/editor/TiptapEditor.tsx` (AlignedImage extension)
- **CSS Styles**: `src/app/globals.css` (image alignment classes)

## Testing

To test the feature:

1. Create a new post or edit an existing one
2. Upload several images of different sizes
3. Resize each image using the bubble menu
4. Set different alignments
5. Save and publish the post
6. View the published post
7. Verify sizes and alignments are correct
8. Click images to test the lightbox

## Known Limitations

- No drag-to-resize handles (uses preset sizes and custom input)
- No aspect ratio lock (images scale proportionally by default)
- No image cropping (uses original uploaded image)
- No automatic format conversion (serves original format)

## Future Roadmap

Planned enhancements:

1. **Server-side Resizing**: Generate multiple sizes on upload using sharp/libvips
2. **Image Optimization**: Automatic WebP/AVIF conversion
3. **Drag Handles**: Visual drag-to-resize in editor
4. **Image Captions**: UI for adding captions (already supported in data model)
5. **Image Effects**: Border, shadow, rounding options
6. **Gallery View**: Swipe between multiple images in lightbox
7. **Zoom Controls**: Pinch-to-zoom, pan functionality
