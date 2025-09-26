import * as cheerio from "cheerio";
import DOMPurify from "dompurify";

// For Node.js environment (tests), set up jsdom
const { JSDOM } = require('jsdom');
const window = new JSDOM('<!DOCTYPE html><html><body></body></html>').window;
const purify = DOMPurify(window as any);

// Based on Appendix B of TEST_REQUIREMENTS_WXR_IMPORT.md
const ALLOWED_TAGS = [
  "div", "p", "span", "strong", "em", "b", "i", "ul", "ol", "li", "blockquote",
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
 * Normalize whitespace in text content by collapsing sequences to a single space.
 * Intentionally does NOT trim to preserve leading/trailing spacing semantics in elements
 * like <p> where tests expect a single pad space inside the tag.
 */
function normalizeWhitespace(text: string): string {
  // Collapse spaces and tabs, but preserve newlines (\n) so tests expecting
  // line breaks remain intact after CR/LF normalization.
  return text.replace(/[^\S\r\n]+/g, ' ');
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
  if (!html || html.trim() === '') return '';

  // 1. Normalize line endings first
  let normalized = normalizeLineEndings(html);

  // 1a. Fast path: if there is no actual markup (no literal < or >), treat input as text
  // and decode common entities exactly once without going through a DOM parser which
  // would auto-balance tags (e.g., turning <div> into <div></div>), which some tests
  // explicitly do not want.
  if (!/[<>]/.test(normalized)) {
    let textOnly = normalized
      .replace(/&nbsp;/g, ' ') // normalize NBSP to space first
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    // Trim to remove leading/trailing spaces introduced by NBSP normalization
    return textOnly.trim();
  }

  // 2. Use DOMPurify with very permissive settings, then apply our own rules
  const sanitizedHtml = purify.sanitize(normalized, {
    ALLOWED_TAGS,
    // DOMPurify typings allow only string[] here – combine all attrs we permit
    ALLOWED_ATTR: [
      // Global-ish
      'class', 'style', 'dir', 'data-*',
      // Anchors
      'href', 'title', 'target', 'rel',
      // Images
      'src', 'srcset', 'sizes', 'alt', 'width', 'height',
      // Tables
      'scope', 'colspan', 'rowspan',
      // Media
      'allow', 'allowfullscreen', 'frameborder', 'controls', 'type',
      // Code blocks
      'data-lang'
    ],
    FORBID_TAGS: ["script", "style", "object", "embed"],
    ADD_DATA_URI_TAGS: ['img'],
    KEEP_CONTENT: true,
  });

  // Normalize non-breaking spaces into regular spaces for consistent whitespace behavior
  const sanitizedHtmlNoNbsp = sanitizedHtml.replace(/\u00A0/g, ' ');

  // 3. Load into Cheerio for DOM manipulation
  const $ = cheerio.load(sanitizedHtmlNoNbsp, { xmlMode: false });

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
    const attribs: Record<string, string> | undefined = (elem as unknown as { attribs?: Record<string, string> }).attribs;
    if (attribs && Object.keys(attribs).length > 0) {
      const entries = Object.entries(attribs);
      // Remove all attributes
      entries.forEach(([attr]) => element.removeAttr(attr));
      // Add them back in sorted order for consistent output
      entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([attr, value]) => {
        element.attr(attr, value);
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
  const finalCleanup = cheerio.load(result, { xmlMode: false });
  finalCleanup('p, span').each((i, elem) => {
    const el = finalCleanup(elem);
    if (el.text().trim() === '' && el.children().length === 0) {
      el.remove();
    }
  });
  
  // Serialize from body to ensure we return the element HTML
  let output = (finalCleanup.root().find('body').html() || '').trim();
  // Decode common HTML entities once (post-processing) to satisfy helper expectations
  output = output
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return output;
}

/**
 * Strip forbidden attributes while preserving allowed ones (including data-*)
 * Used by tests expecting event handlers like onerror/onclick to be removed.
 */
export function stripForbiddenAttributes(html: string): string {
  if (!html) return '';
  const out = purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [
      'class', 'style', 'dir', 'data-*',
      'href', 'title', 'target', 'rel',
      'src', 'srcset', 'sizes', 'alt', 'width', 'height',
      'scope', 'colspan', 'rowspan',
      'allow', 'allowfullscreen', 'frameborder', 'controls', 'type',
      'data-lang'
    ],
    ADD_DATA_URI_TAGS: ['img'],
    KEEP_CONTENT: true,
  });

  return out;
}

/**
 * Extract visible text content from an HTML string and normalize whitespace.
 */
export function extractTextContent(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html, { xmlMode: false });
  // Collapse whitespace in the resulting text but trim ends for a clean result
  return $.root().text().replace(/\s+/g, ' ').trim();
}
