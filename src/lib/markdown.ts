// SPDX-License-Identifier: Apache-2.0
import { marked } from "marked";
import { sanitizeHtml } from "./sanitize";

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
    /<a href="(https?:\/\/[^"]+)"([^>]*)>/g,
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
    // Convert markdown to HTML synchronously
    const rawHtml = marked.parse(markdown.trim()) as string;
    
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
    // Convert markdown to HTML
    const rawHtml = await marked(markdown.trim()) as string;
    
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