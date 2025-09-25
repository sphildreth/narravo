import cheerio from "cheerio";
import DOMPurify from "isomorphic-dompurify";

// Based on Appendix B of TEST_REQUIREMENTS_WXR_IMPORT.md
const ALLOWED_TAGS = [
  "p", "span", "strong", "em", "b", "i", "ul", "ol", "li", "blockquote",
  "pre", "code", "img", "a", "figure", "figcaption", "table", "thead",
  "tbody", "tfoot", "tr", "th", "td", "video", "audio", "source", "iframe"
];

// Trusted iframe hosts for allowlisting
const TRUSTED_IFRAME_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'player.vimeo.com'
];

/**
 * Check if an iframe source URL is from a trusted host
 */
function isTrustedIframeHost(src: string): boolean {
  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();
    return TRUSTED_IFRAME_HOSTS.some(trusted => 
      hostname === trusted || hostname.endsWith('.' + trusted)
    );
  } catch {
    return false;
  }
}

/**
 * Normalize whitespace in text content
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize line endings to Unix style (\n)
 */
function normalizeLineEndings(html: string): string {
  return html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Sanitize and normalize HTML for consistent snapshot testing
 * Implements the complete HTML sanitization policy from Appendix B
 */
export function normalizeHtml(html: string): string {
  if (!html) return '';

  // 1. Normalize line endings first
  let normalized = normalizeLineEndings(html);

  // 2. Use DOMPurify with very permissive settings, then apply our own rules
  const sanitizedHtml = DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: {
      '*': ['class', 'style', 'dir', 'data-*'],
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'data-*'],
      'iframe': ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
      'th': ['scope', 'colspan', 'rowspan'],
      'td': ['colspan', 'rowspan'],
      'video': ['src', 'controls', 'type', 'width', 'height'],
      'audio': ['src', 'controls', 'type'],
      'source': ['src', 'type'],
      'code': ['class', 'data-lang'],
      'pre': ['class'],
      'blockquote': ['cite'],
    },
    FORBID_TAGS: ["script", "style", "object", "embed"],
    ADD_DATA_URI_TAGS: ['img'],
    KEEP_CONTENT: true,
  });

  // 3. Load into Cheerio for DOM manipulation
  const $ = cheerio.load(sanitizedHtml, {
    xmlMode: false,
    decodeEntities: true,
  });

  // 4. Process iframes: strip non-trusted ones, keep trusted ones
  $('iframe').each((i, elem) => {
    const iframe = $(elem);
    const src = iframe.attr('src');
    
    if (!src || !isTrustedIframeHost(src)) {
      // Remove non-trusted iframes
      iframe.remove();
    } else {
      // Keep trusted iframes, ensure they have safe attributes
      iframe.removeAttr('onload').removeAttr('onerror'); // Remove any event handlers
    }
  });

  // 5. Handle anchor tags per security requirements
  $('a[target="_blank"]').each((i, elem) => {
    const anchor = $(elem);
    const rel = anchor.attr('rel') || '';
    const relParts = rel.split(' ').filter(Boolean);
    
    // Ensure noopener and noreferrer are present for target="_blank"
    if (!relParts.includes('noopener')) {
      relParts.push('noopener');
    }
    if (!relParts.includes('noreferrer')) {
      relParts.push('noreferrer');
    }
    
    anchor.attr('rel', relParts.sort().join(' '));
  });

  // 6. Validate images and remove ones without src
  $('img').each((i, elem) => {
    const img = $(elem);
    const src = img.attr('src');
    if (!src) {
      img.remove();
    }
  });

  // 7. Preserve list structure and ensure proper nesting
  $('ul, ol').each((i, elem) => {
    const list = $(elem);
    // Ensure only li elements are direct children
    list.children().each((j, child) => {
      if (child.tagName !== 'li') {
        $(child).wrap('<li></li>');
      }
    });
  });

  // 8. Preserve table structure
  $('table').each((i, elem) => {
    const table = $(elem);
    // Ensure proper table structure exists
    if (table.find('tbody').length === 0 && table.find('tr').length > 0) {
      table.find('tr').wrapAll('<tbody></tbody>');
    }
  });

  // 9. Normalize attributes for all elements (alphabetical order)
  $('*').each((i, elem) => {
    const element = $(elem);
    const attrs = element.attr() as Record<string, string> | undefined;
    
    if (attrs) {
      // Remove all attributes
      Object.keys(attrs).forEach(attr => element.removeAttr(attr));
      
      // Add them back in sorted order for consistent output
      Object.keys(attrs).sort().forEach(attr => {
        element.attr(attr, attrs[attr]);
      });
    }
  });

  // 10. Normalize whitespace in text nodes while preserving structure
  $('*').each((i, elem) => {
    const element = $(elem);
    
    // Don't normalize whitespace in pre/code elements
    if (element.is('pre, code')) {
      return;
    }
    
    // Normalize text content for other elements
    element.contents().each((j, node) => {
      if (node.type === 'text') {
        const normalized = normalizeWhitespace(node.data || '');
        if (normalized !== node.data) {
          $(node).replaceWith(normalized);
        }
      }
    });
  });

  // 11. Return the processed, normalized HTML string
  const result = $('body').html() || '';
  
  // 12. Final cleanup - remove empty elements that shouldn't be empty
  const finalCleanup = cheerio.load(result, { xmlMode: false, decodeEntities: true });
  finalCleanup('p, div, span').each((i, elem) => {
    const el = finalCleanup(elem);
    if (el.text().trim() === '' && el.children().length === 0) {
      el.remove();
    }
  });
  
  return finalCleanup('body').html() || '';
}
