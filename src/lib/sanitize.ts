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
export function sanitizeHtml(html: string, allowIframes = true): string {
  const fragment = purifyInstance.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
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
      // Code highlighting attributes. DOMPurify's allowlist is global, so a
      // post-filter below removes class from every element except pre/code.
      "class", "data-lang",
      // Task list checkbox attributes
      "checked", "disabled",
      // Image sizing/alignment is represented by the constrained data
      // attributes below. Arbitrary inline CSS can create deceptive overlays
      // and trigger remote resource requests even without JavaScript.
    ],
    // Explicitly allow select data attributes used by trusted extensions
    ADD_ATTR: ["data-mermaid", "data-width", "data-align"],
    // Additional security options
    ALLOW_DATA_ATTR: false, // No data-* attributes except those explicitly allowed
    ALLOW_UNKNOWN_PROTOCOLS: false, // Only allow known URL protocols
    SANITIZE_DOM: true, // Sanitize DOM nodes
    KEEP_CONTENT: true, // Keep text content even if tags are removed
    // Ensure external links are safe
    FORBID_TAGS: ["script", "object", "embed", "form", ...(allowIframes ? [] : ["iframe"])],
  });

  for (const iframe of fragment.querySelectorAll("iframe")) {
    try {
      const u = new URL(iframe.getAttribute("src") ?? "");
      if (u.protocol !== "https:" || !/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(u.hostname)) iframe.remove();
    } catch { iframe.remove(); }
  }
  for (const input of fragment.querySelectorAll("input")) {
    if (input.type !== "checkbox") { input.remove(); continue; }
    for (const attr of [...input.attributes]) {
      if (!["type", "checked", "disabled"].includes(attr.name)) input.removeAttribute(attr.name);
    }
  }
  for (const element of fragment.querySelectorAll("[class]")) {
    const classes = Array.from(element.classList).filter(c =>
      /^(pre|code)$/i.test(element.tagName) && /^(prism|language|lang|hljs|undefined|numbers|line|mermaid)[\w-]*$/i.test(c));
    if (classes.length) element.setAttribute("class", classes.join(" "));
    else element.removeAttribute("class");
  }
  const wrapper = fragment.ownerDocument.createElement("div");
  wrapper.append(fragment);
  return wrapper.innerHTML;
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
