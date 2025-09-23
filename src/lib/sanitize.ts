// SPDX-License-Identifier: Apache-2.0
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks
 * This configuration is designed to work with markdown-generated HTML
 * and allows common formatting elements while blocking dangerous content.
 */
export function sanitizeHtml(html: string): string {
  let sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "a", "strong", "em", "code", "pre", "ul", "ol", "li", 
      "blockquote", "img", "br", "span", "h1", "h2", "h3", "h4", "h5", "h6",
      // Allow safe media tags
      "video", "source",
      // Allow tables (needed for WordPress imports)
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col"
    ],
    // Allowed attributes
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "target", "rel", "controls", "poster",
      // Video-related safe attributes
      "muted", "loop", "playsinline", "preload", "width", "height", "type",
      // Table-related safe attributes
      "colspan", "rowspan", "scope",
      // Code highlighting attributes - allow class for pre/code tags only
      "class", "data-lang"
    ],
    // Additional security options
    ALLOW_DATA_ATTR: false, // No data-* attributes except those explicitly allowed
    ALLOW_UNKNOWN_PROTOCOLS: false, // Only allow known URL protocols
    SANITIZE_DOM: true, // Sanitize DOM nodes
    KEEP_CONTENT: true, // Keep text content even if tags are removed
    // Ensure external links are safe
    FORBID_TAGS: ["script", "object", "embed", "iframe", "form", "input"],
  });

  // Post-process to filter dangerous class names on code elements
  sanitized = sanitized.replace(
    /<(pre|code)([^>]*?)\sclass=["']([^"']*?)["']/gi,
    (match, tagName, attrs, className) => {
      // Only allow safe syntax highlighting classes
      const safeClasses = className
        .split(/\s+/)
        .filter((cls: string) => /^(prism|language|lang|hljs|undefined|numbers|line)[\w-]*$/i.test(cls))
        .join(' ');
      
      if (safeClasses) {
        return `<${tagName}${attrs} class="${safeClasses}"`;
      } else {
        // Remove class attribute if no safe classes found
        return `<${tagName}${attrs}`;
      }
    }
  );

  return sanitized;
}

/**
 * Sanitize comment-specific HTML with more restrictive rules
 * Comments should have fewer formatting options than posts
 */
export function sanitizeCommentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // More restrictive tag list for comments
    ALLOWED_TAGS: [
      "p", "a", "strong", "em", "code", "ul", "ol", "li", 
      "blockquote", "br"
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    FORBID_ATTR: [
      "onerror", "onclick", "onload", "onmouseover", "onfocus", 
      "onblur", "onchange", "onsubmit", "style", "class", "src"
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    FORBID_TAGS: ["script", "object", "embed", "iframe", "form", "input", "img"],
  });
}
