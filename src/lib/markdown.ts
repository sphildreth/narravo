// SPDX-License-Identifier: Apache-2.0
import { marked } from "marked";
import { sanitizeHtml } from "./sanitize";

export function expandShortcodes(markdown: string): string {
  if (!markdown || typeof markdown !== "string") return "";

  // Video shortcode: [video mp4="..." webm="..." ogv="..." width="400" height="300" poster="..."][/video]
  const videoRe = /\[video([^\]]*)\](?:\s*\[\/video\])?/gi;

  return markdown.replace(videoRe, (_full, attrStr: string) => {
    // Parse both valued attributes (key="value") and boolean attributes (key)
    const attrRe = /(\w+)(?:=("[^"]*"|'[^']*'|[^\s"']+))?/g;
    const attrs: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrStr))) {
      const rawKey = m[1] ?? "";
      if (!rawKey) continue;
      const key = rawKey.toLowerCase();
      let val = m[2] ?? "";
      if (val) {
        // Remove quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        attrs[key] = val;
      } else {
        // Boolean attribute (no value)
        attrs[key] = "";
      }
    }

    const sources: Array<{ src: string; type: string }> = [];
    const addIfHttp = (url?: string | null, type?: string) => {
      if (!url) return;
      try {
        const u = new URL(url);
        if (u.protocol === "http:" || u.protocol === "https:") {
          sources.push({ src: url, type: type || "" });
        }
      } catch {
        // ignore invalid URLs
      }
    };

    addIfHttp(attrs.mp4, "video/mp4");
    addIfHttp(attrs.webm, "video/webm");
    addIfHttp(attrs.ogv || attrs.ogg, "video/ogg");

    if (sources.length === 0) {
      // No valid sources, keep original text
      return _full;
    }

    const width = attrs.width && /^\d+$/.test(attrs.width) ? ` width="${attrs.width}"` : "";
    const height = attrs.height && /^\d+$/.test(attrs.height) ? ` height="${attrs.height}"` : "";

    const posterAttr = (() => {
      if (!attrs.poster) return "";
      try {
        const u = new URL(attrs.poster);
        return (u.protocol === "http:" || u.protocol === "https:") ? ` poster="${attrs.poster}"` : "";
      } catch {
        return "";
      }
    })();

    const autoplay = attrs.autoplay !== undefined ? " autoplay" : "";
    // If autoplay is set, muted and playsinline are typically required for browsers to auto-play inline
    const muted = (attrs.autoplay !== undefined || attrs.muted !== undefined) ? " muted" : "";
    const playsinline = (attrs.autoplay !== undefined || attrs.playsinline !== undefined) ? " playsinline" : "";
    const loop = attrs.loop !== undefined ? " loop" : "";

    const sourcesHtml = sources
      .map(s => `<source src="${s.src}"${s.type ? ` type="${s.type}"` : ""} />`)
      .join("");

    const fallbackLink = `<a href="${sources[0]!.src}">Download video</a>`;

    const srcAttr = sources[0] ? ` src="${sources[0]!.src}"` : "";
    const sourcesData = sources.length
      ? ` data-sources="${encodeURIComponent(JSON.stringify(sources))}"`
      : "";
    const primarySrcData = sources[0]
      ? ` data-shortcode-src="${sources[0]!.src}"`
      : "";

    return `<div data-video-shortcode="true" class="video-shortcode-frame"><video controls preload="metadata" data-shortcode-preview="true"${srcAttr}${width}${height}${posterAttr}${autoplay}${muted}${playsinline}${loop}${sourcesData}${primarySrcData}>${sourcesHtml}${fallbackLink}</video></div>`;
  });
}

/**
 * Configure marked with security-focused options
 */
function configureMarked() {
  marked.setOptions({
    // Break on line breaks
    breaks: true,
    // Use GitHub Flavored Markdown
    gfm: true,
  });
}

// Initialize marked configuration
configureMarked();

/**
 * Post-process HTML to add security attributes to external links
 */
function postProcessHtml(html: string): string {
  // Add security attributes to external links
  return html.replace(
    /<a href="(https?:\/\/[^\"]+)"([^>]*)>/g,
    '<a href="$1"$2 target="_blank" rel="noopener noreferrer">'
  );
}

/**
 * Synchronous version of markdownToHtml for compatibility
 */
export function markdownToHtmlSync(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Expand shortcodes before parsing
    const preprocessed = expandShortcodes(markdown.trim());

    // Convert markdown to HTML synchronously
    const rawHtml = marked.parse(preprocessed) as string;

    // Sanitize the resulting HTML first
    const sanitizedHtml = sanitizeHtml(rawHtml);
    
    // Then post-process for security attributes
    const processedHtml = postProcessHtml(sanitizedHtml);
    
    return processedHtml;
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    // Return a safe fallback
    return sanitizeHtml(`<p>Error processing content</p>`);
  }
}

/**
 * Convert markdown to sanitized HTML (async version)
 * @param markdown - The raw markdown content
 * @returns Promise resolving to sanitized HTML string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Expand shortcodes before parsing
    const preprocessed = expandShortcodes(markdown.trim());

    // Convert markdown to HTML
    const rawHtml = await marked(preprocessed) as string;

    // Sanitize the resulting HTML first
    const sanitizedHtml = sanitizeHtml(rawHtml);
    
    // Then post-process for security attributes
    const processedHtml = postProcessHtml(sanitizedHtml);
    
    return processedHtml;
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    // Return a safe fallback
    return sanitizeHtml(`<p>Error processing content</p>`);
  }
}

/**
 * Extract a plain text excerpt from markdown
 * @param markdown - The raw markdown content
 * @param maxLength - Maximum length of excerpt (default: 160)
 * @returns Plain text excerpt
 */
export function extractExcerpt(markdown: string, maxLength: number = 160): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Convert to HTML first
    const html = marked.parse(markdown.trim()) as string;
    
    // Strip HTML tags to get plain text
    const plainText = html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate to desired length
    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Find the last complete word before the limit
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) { // If we're close enough, use the word boundary
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  } catch (error) {
    console.error('Error extracting excerpt from markdown:', error);
    return '';
  }
}

/**
 * Test if a string appears to be markdown content
 * @param content - Content to test
 * @returns True if content appears to be markdown
 */
export function isMarkdown(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Simple heuristics for markdown detection
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers
    /^\*\s+/m, // Unordered lists with *
    /^-\s+/m, // Unordered lists with -
    /^\d+\.\s+/m, // Ordered lists
    /\*\*.*\*\*/, // Bold
    /\*.*\*/, // Italic
    /\[.*\]\(.*\)/, // Links
    /```[\s\S]*```/, // Code blocks
    /`.*`/, // Inline code
    /^>\s+/m, // Blockquotes
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
}