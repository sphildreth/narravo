// SPDX-License-Identifier: Apache-2.0
import DOMPurify from "dompurify";

// For server-side rendering, we need to create a DOM environment
let purifyInstance: typeof DOMPurify;

if (typeof window !== 'undefined') {
  // Client-side: use DOMPurify directly
  purifyInstance = DOMPurify;
} else {
  // Server-side: create a DOM environment using jsdom
  const { JSDOM } = require('jsdom');
  const window = new JSDOM('<!DOCTYPE html><html><body></body></html>').window;
  purifyInstance = DOMPurify(window as any);
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * This configuration is designed to work with markdown-generated HTML
 * and allows common formatting elements while blocking dangerous content.
 */
export function sanitizeHtml(html: string): string {
  let sanitized = purifyInstance.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "a", "strong", "em", "code", "pre", "ul", "ol", "li", 
      "blockquote", "img", "br", "span", "h1", "h2", "h3", "h4", "h5", "h6",
      // Allow safe media tags
      "video", "source",
      // Allow figures from WordPress blocks
      "figure",
      // Allow safe iframes (we'll restrict by host post-sanitize)
      "iframe",
      // Allow tables (needed for WordPress imports)
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
      // Allow input tags for task list checkboxes
      "input"
    ],
    // Allowed attributes
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "target", "rel", "controls", "poster",
      // Responsive image attributes
      "srcset", "sizes",
      // Video/iframe-related safe attributes
      "muted", "loop", "playsinline", "preload", "width", "height", "type",
      "frameborder", "allow", "allowfullscreen", "referrerpolicy",
      // Table-related safe attributes
      "colspan", "rowspan", "scope",
      // Code highlighting attributes - allow class for pre/code tags only
      "class", "data-lang",
      // Task list checkbox attributes
      "checked", "disabled",
      // Image styling attributes
      "style"
    ],
    // Explicitly allow select data attributes used by trusted extensions
    ADD_ATTR: ["data-mermaid", "data-width", "data-align"],
    // Additional security options
    ALLOW_DATA_ATTR: false, // No data-* attributes except those explicitly allowed
    ALLOW_UNKNOWN_PROTOCOLS: false, // Only allow known URL protocols
    SANITIZE_DOM: true, // Sanitize DOM nodes
    KEEP_CONTENT: true, // Keep text content even if tags are removed
    // Ensure external links are safe
    FORBID_TAGS: ["script", "object", "embed", "form"],
  });

  // Post-process: allow only YouTube iframes, strip others entirely
  sanitized = sanitized.replace(/<iframe([^>]*)>(.*?)<\/iframe>/gi, (m, attrs) => {
    const srcMatch = String(attrs).match(/\ssrc=["']([^"']+)["']/i);
    const src = srcMatch?.[1] || "";
    try {
      const u = new URL(src, "https://example.com");
      const host = u.hostname.toLowerCase();
      const allowed = /(^|\.)youtube\.com$/.test(host) || /(^|\.)youtu\.be$/.test(host) || /(^|\.)youtube-nocookie\.com$/.test(host);
      return allowed ? `<iframe${attrs}></iframe>` : "";
    } catch {
      return "";
    }
  });

  // Post-process: only allow checkbox inputs for task lists, remove others
  sanitized = sanitized.replace(/<input([^>]*)>/gi, (match, attrs) => {
    // Check if this is a checkbox input
    if (/\btype\s*=\s*["']?checkbox["']?/i.test(attrs)) {
      // This is a checkbox, keep it but ensure only safe attributes
      const safeAttrs = attrs
        .replace(/\b(?:on\w+|style|formaction|form|name|value)\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\btype\s*=\s*["']?[^"'\s]*["']?/gi, 'type="checkbox"');
      return `<input${safeAttrs}>`;
    }
    // Remove any other input types
    return '';
  });

  // Post-process to filter dangerous class names on code elements
  sanitized = sanitized.replace(
    /<(pre|code)([^>]*?)\sclass=["']([^"']*?)["']/gi,
    (match, tagName, attrs, className) => {
      // Only allow safe syntax highlighting classes
      const safeClasses = className
        .split(/\s+/)
    .filter((cls: string) => /^(prism|language|lang|hljs|undefined|numbers|line|mermaid)[\w-]*$/i.test(cls))
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
  return purifyInstance.sanitize(html, {
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
