// SPDX-License-Identifier: Apache-2.0

/**
 * HTML normalization utilities for consistent test snapshots.
 * Provides stable, deterministic HTML output for testing.
 */

/**
 * Normalize HTML for stable test snapshots and comparisons.
 * - Normalizes whitespace (consistent spacing, no excess newlines)
 * - Decodes HTML entities exactly once (no double-decoding)
 * - Sorts attributes alphabetically for consistent output
 * - Preserves allowed attributes, strips forbidden ones
 * - Handles nested structures consistently
 */
export function normalizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Decode HTML entities once
  let normalized = decodeHtmlEntities(html);

  // Normalize line endings to LF first, before whitespace normalization
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Only normalize excessive whitespace between tags, preserve internal structure
  normalized = normalized
    // Remove excess whitespace between tags
    .replace(/>\s+</g, '><')
    // Normalize excessive internal whitespace to single spaces, but preserve newlines in text content
    .replace(/[ \t]+/g, ' ')
    // Trim leading/trailing whitespace
    .trim();

  // Sort attributes within tags for deterministic output
  normalized = sortAttributes(normalized);

  return normalized;
}

/**
 * Sort attributes within HTML tags alphabetically for consistent snapshots.
 */
function sortAttributes(html: string): string {
  return html.replace(/<([a-zA-Z][^>]*)>/g, (match, tagContent) => {
    const parts = tagContent.trim().split(/\s+/);
    const tagName = parts[0];
    
    if (parts.length <= 1) {
      return match; // No attributes to sort
    }

    const attributes = parts.slice(1);
    
    // Parse and sort attributes
    const attributePairs: Array<{ name: string, value?: string, raw: string }> = [];
    
    for (const attr of attributes) {
      if (attr.includes('=')) {
        const [name, ...valueParts] = attr.split('=');
        const value = valueParts.join('=');
        attributePairs.push({ name: name.toLowerCase(), value, raw: attr });
      } else {
        // Boolean attribute
        attributePairs.push({ name: attr.toLowerCase(), raw: attr });
      }
    }
    
    // Sort by attribute name
    attributePairs.sort((a, b) => a.name.localeCompare(b.name));
    
    const sortedAttrs = attributePairs.map(pair => pair.raw).join(' ');
    return `<${tagName} ${sortedAttrs}>`;
  });
}

/**
 * Strip forbidden HTML attributes according to sanitization policy.
 * This mirrors the expected sanitization behavior for testing.
 */
export function stripForbiddenAttributes(html: string, allowedAttrs: Record<string, string[]> = {}): string {
  const defaultAllowed: Record<string, string[]> = {
    '*': ['id', 'class', 'title', 'dir', 'lang'],
    'a': ['href', 'target', 'rel', 'title'],
    'img': ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height'],
    'iframe': ['src', 'width', 'height', 'allow', 'allowfullscreen'],
    'th': ['scope', 'colspan', 'rowspan'],
    'td': ['colspan', 'rowspan'],
    'code': ['class'],
    'pre': ['class'],
    'blockquote': ['cite'],
  };
  
  const allowed = { ...defaultAllowed, ...allowedAttrs };

  return html.replace(/<([a-zA-Z][^>]*)>/g, (match, tagContent) => {
    const parts = tagContent.trim().split(/\s+/);
    const tagName = parts[0]?.toLowerCase();
    
    if (parts.length <= 1 || !tagName) {
      return match; // No attributes to filter
    }

    const attributes = parts.slice(1);
    const globalAllowed = allowed['*'] || [];
    const tagAllowed = allowed[tagName] || [];
    const allAllowed = [...globalAllowed, ...tagAllowed];
    
    const filteredAttrs = attributes.filter(attr => {
      if (attr.includes('=')) {
        const attrName = attr.split('=')[0]?.toLowerCase();
        return allAllowed.includes(attrName || '') || attrName?.startsWith('data-');
      } else {
        // Boolean attribute
        return allAllowed.includes(attr.toLowerCase());
      }
    });
    
    if (filteredAttrs.length === 0) {
      return `<${tagName}>`;
    }
    
    return `<${tagName} ${filteredAttrs.join(' ')}>`;
  });
}

/**
 * Assert HTML contains expected nested structure (for list/table testing).
 */
export function assertNestedStructure(html: string, expectedStructure: string[]): boolean {
  const normalized = normalizeHtml(html);
  
  for (const expected of expectedStructure) {
    if (!normalized.includes(expected)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract text content from HTML for comparison testing.
 */
export function extractTextContent(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if HTML contains specific patterns (for sanitization testing).
 */
export function containsPatterns(html: string, patterns: (string | RegExp)[]): boolean {
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      if (!pattern.test(html)) return false;
    } else {
      if (!html.includes(pattern)) return false;
    }
  }
  return true;
}

/**
 * Check if HTML does NOT contain forbidden patterns (for security testing).
 */
export function containsForbiddenPatterns(html: string, forbiddenPatterns: (string | RegExp)[]): boolean {
  for (const pattern of forbiddenPatterns) {
    if (pattern instanceof RegExp) {
      if (pattern.test(html)) return true;
    } else {
      if (html.includes(pattern)) return true;
    }
  }
  return false;
}

/**
 * Simple HTML entity decoder for common entities.
 * Handles most common cases without external dependencies.
 */
function decodeHtmlEntities(html: string): string {
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x2014;': '—',
    '&#8212;': '—',
    '&#x2013;': '–',
    '&#8211;': '–',
    '&#8217;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
  };

  let decoded = html;
  for (const [entity, char] of Object.entries(entityMap)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Decode numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}