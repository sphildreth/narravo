// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-console */
import { parseStringPromise } from "xml2js";
import { db } from "@/lib/db";
import { posts, redirects, categories, tags, postTags, comments, users, importJobs, importJobErrors } from "@/drizzle/schema";
import { sanitizeHtml } from "@/lib/sanitize";
import { getS3Config, S3Service } from "@/lib/s3";
import { localStorageService, LocalStorageService } from "@/lib/local-storage";
import slugify from "slugify";
import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import { sql, eq } from "drizzle-orm";
import { expandShortcodes } from "@/lib/markdown";
import { generateExcerpt } from "@/lib/excerpts/ExcerptService";

/**
 * Represents the structure of an <item> element in a WordPress WXR export file.
 */
export interface WxrItem {
  title?: string;
  link?: string;
  pubDate?: string;
  "dc:creator"?: string;
  guid?: string | { _: string; "$": { isPermaLink: string } };
  "content:encoded"?: string;
  "excerpt:encoded"?: string;
  "wp:post_id"?: string;
  "wp:post_date"?: string;
  "wp:post_date_gmt"?: string;
  "wp:post_name"?: string;
  "wp:status"?: string;
  "wp:post_type"?: string;
  "wp:post_parent"?: string;
  "wp:attachment_url"?: string;
  "wp:postmeta"?: Array<{ 
    "wp:meta_key": string;
    "wp:meta_value": string;
  }>;
  "wp:comment"?: Array<{ 
    "wp:comment_id": string;
    "wp:comment_author": string;
    "wp:comment_author_email": string;
    "wp:comment_date": string;
    "wp:comment_date_gmt": string;
    "wp:comment_content": string;
    "wp:comment_approved": string;
    "wp:comment_type": string;
    "wp:comment_parent": string;
  }>;
  category?: Array<{ 
    _: string;
    "$": {
      domain: string;
      nicename: string;
    };
  }>;
}

/**
 * Represents a parsed WordPress post, ready for import.
 */
export interface ParsedPost {
  type: "post";
  importedSystemId: string;
  title: string;
  slug: string;
  html: string;
  excerpt?: string | undefined;
  author: string;
  publishedAt?: Date | undefined;
  originalUrl?: string | undefined;
  featuredImageId?: string | undefined;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
  comments: Array<{ 
    id: string;
    author: string;
    authorEmail?: string | undefined;
    content: string;
    date?: Date | undefined;
    approved: boolean;
    parentId?: string | undefined;
  }>;
}

/**
 * Represents a parsed WordPress attachment (media item).
 */
export interface ParsedAttachment {
  type: "attachment";
  importedSystemId: string;
  title: string;
  attachmentUrl: string;
  alt?: string | undefined;
}

/**
 * Options to configure the WXR import process.
 */
export interface ImportOptions {
  dryRun?: boolean;
  skipMedia?: boolean;
  verbose?: boolean;
  allowedStatuses?: string[];
  purgeBeforeImport?: boolean;
  concurrency?: number;
  allowedHosts?: string[];
  jobId?: string;
  rebuildExcerpts?: boolean; // new flag
}

/**
 * The result of an import operation, including a summary and any errors.
 */
export interface ImportResult {
  summary: {
    totalItems: number;
    postsImported: number;
    attachmentsProcessed: number;
    redirectsCreated: number;
    skipped: number;
  };
  errors: Array<{ item: string; error: string }>;
  dryRun: boolean;
  mediaUrls: Map<string, string>; // old URL -> new URL mapping
}

/**
 * Parses a raw WXR item object into a structured `ParsedPost`, `ParsedAttachment`, or null.
 * @param item The raw item object from xml2js.
 * @returns A parsed object or null if the item type is not supported or invalid.
 */
export function parseWxrItem(item: WxrItem): ParsedPost | ParsedAttachment | null {
  const postType = item["wp:post_type"];

  // Extract importedSystemId (WordPress GUID)  
  let importedSystemId: string;
  if (typeof item.guid === "string") {
    importedSystemId = item.guid;
  } else if (item.guid && typeof item.guid === "object" && item.guid._) {
    importedSystemId = item.guid._;
  } else {
    return null; // No guid, skip
  }

  if (postType === "post") {
    // Parse categories and tags
    const categories: Array<{ name: string; slug: string }> = [];
    const tags: Array<{ name: string; slug: string }> = [];
    
    if (item.category) {
      const categoryArray = Array.isArray(item.category) ? item.category : [item.category];
      for (const cat of categoryArray) {
        if (cat.$.domain === "category") {
          categories.push({
            name: cat._,
            slug: cat.$.nicename || slugify(cat._, { lower: true, strict: true })
          });
        } else if (cat.$.domain === "post_tag") {
          tags.push({
            name: cat._,
            slug: cat.$.nicename || slugify(cat._, { lower: true, strict: true })
          });
        }
      }
    }

    // Parse comments
    const comments: ParsedPost["comments"] = [];
    if (item["wp:comment"]) {
      const commentArray = Array.isArray(item["wp:comment"]) ? item["wp:comment"] : [item["wp:comment"]];
      for (const comment of commentArray) {
        comments.push({
          id: comment["wp:comment_id"],
          author: comment["wp:comment_author"],
          authorEmail: comment["wp:comment_author_email"],
          content: comment["wp:comment_content"],
          date: comment["wp:comment_date_gmt"] ? new Date(comment["wp:comment_date_gmt"]) : undefined,
          approved: comment["wp:comment_approved"] === "1",
          parentId: comment["wp:comment_parent"] !== "0" ? comment["wp:comment_parent"] : undefined,
        });
      }
    }

    // Get featured image ID from post meta
    let featuredImageId: string | undefined;
    if (item["wp:postmeta"]) {
      const metaArray = Array.isArray(item["wp:postmeta"]) ? item["wp:postmeta"] : [item["wp:postmeta"]];
      const thumbnailMeta = metaArray.find(meta => meta["wp:meta_key"] === "_thumbnail_id");
      if (thumbnailMeta) {
        featuredImageId = thumbnailMeta["wp:meta_value"];
      }
    }

    return {
      type: "post",
      importedSystemId,
      title: item.title || "Untitled",
      slug: item["wp:post_name"] || slugify(item.title || "untitled", { lower: true, strict: true }),
      html: item["content:encoded"] || "",
      excerpt: item["excerpt:encoded"],
      author: item["dc:creator"] || "unknown",
      publishedAt: item["wp:post_date_gmt"] ? new Date(item["wp:post_date_gmt"]) : undefined,
      originalUrl: item.link,
      featuredImageId,
      categories,
      tags,
      comments,
    };
  } else if (postType === "attachment") {
    // Get alt text from post meta
    let alt: string | undefined;
    if (item["wp:postmeta"]) {
      const metaArray = Array.isArray(item["wp:postmeta"]) ? item["wp:postmeta"] : [item["wp:postmeta"]];
      const altMeta = metaArray.find(meta => meta["wp:meta_key"] === "_wp_attachment_image_alt");
      if (altMeta) {
        alt = altMeta["wp:meta_value"];
      }
    }

    return {
      type: "attachment",
      importedSystemId,
      title: item.title || "Untitled",
      attachmentUrl: item["wp:attachment_url"] || "",
      alt,
    };
  }

  return null; // Skip other post types
}

/**
 * Guesses the MIME type of a file based on its URL's extension.
 * @param url The URL of the file.
 * @param fallback The content type to return if no match is found.
 * @returns The guessed MIME type string.
 */
function guessContentType(url: string, fallback: string = 'application/octet-stream'): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return fallback;
}

/**
 * Extracts the file extension from a URL.
 * @param url The URL to parse.
 * @returns The file extension in lowercase, or "bin" as a fallback.
 */
function getExtensionFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const pathname = u.pathname || "";
    const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
    const idx = filename.lastIndexOf(".");
    if (idx > 0 && idx < filename.length - 1) {
      return filename.substring(idx + 1).toLowerCase();
    }
  } catch {
    // Fallback to naive parsing if URL constructor fails
    const cleaned = url.split("?")[0]?.split("#")[0] ?? url;
    const idx = cleaned.lastIndexOf(".");
    if (idx > -1) return cleaned.substring(idx + 1).toLowerCase();
  }
  return "bin";
}

/**
 * Downloads a media file from a given URL and uploads it to the configured storage (S3 or local).
 * @param url The URL of the media file to download.
 * @param s3Service An S3 service instance, or null.
 * @param localService A local storage service instance, or null.
 * @param allowedHosts A list of allowed hostnames to download from.
 * @param opts Options for the download process (e.g., dryRun, verbose).
 * @returns The new public URL of the uploaded media, or null if the download failed or was skipped.
 */
async function downloadMedia(
  url: string,
  s3Service: S3Service | null,
  localService: LocalStorageService | null,
  allowedHosts: string[],
  opts?: { dryRun?: boolean; verbose?: boolean }
): Promise<string | null> {
  const dryRun = opts?.dryRun ?? false;
  const verbose = opts?.verbose ?? false;

  if (!s3Service && !localService) {
    return null; // No storage configured, skip download
  }

  // In dry-run without remote storage configured, avoid making real network calls
  if (dryRun && !s3Service) {
    if (verbose) console.log(`⏩ Dry-run without S3 configured, skipping media download: ${url}`);
    return null;
  }

  try {
    // Check if URL is allowed
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const hostAllowed = (hosts: string[], host: string): boolean => {
      if (hosts.length === 0) return true;
      for (const raw of hosts) {
        const a = raw.trim().toLowerCase().replace(/^\.+/, "");
        if (!a) continue;
        if (host === a) return true;
        if (host.endsWith(`.${a}`)) return true; // allow subdomains of an allowed registrable domain
      }
      return false;
    };
    if (!hostAllowed(allowedHosts, hostname)) {
      throw new Error(`Host ${hostname} not in allowlist`);
    }

    // Download file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Narravo-WXR-Importer/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Use hash as key to avoid duplicates
    const extension = getExtensionFromUrl(url);
    const key = `imported-media/${hash}.${extension}`;
    
    // Upload to S3 or local storage
    const contentType = response.headers.get('content-type') || guessContentType(url);
    
    if (s3Service) {
      await s3Service.putObject(key, buffer, contentType);
      return s3Service.getPublicUrl(key);
    } else if (localService) {
      await localService.putObject(key, buffer, contentType);
      return localService.getPublicUrl(key);
    }
    
    return null;
  } catch (error) {
    if (verbose) {
      console.warn(`Skipping media ${url}:`, error);
    }
    return null;
  }
}

/**
 * Rewrites all occurrences of old media URLs in an HTML string with their new URLs.
 * @param html The HTML content to process.
 * @param mediaUrlMap A map of old URLs to new URLs.
 * @returns The HTML content with rewritten URLs.
 */
function rewriteMediaUrls(html: string, mediaUrlMap: Map<string, string>): string {
  let rewritten = html;
  
  for (const [oldUrl, newUrl] of mediaUrlMap) {
    // Replace any occurrence (src, href, srcset, poster, CSS url())
    rewritten = rewritten.replace(
      new RegExp(escapeRegExp(oldUrl), 'g'),
      newUrl
    );
  }
  
  return rewritten;
}

/**
 * Normalizes common WordPress list markup issues (e.g., `<p>` tags wrapping lists)
 * before HTML sanitization.
 * @param html The raw HTML from WordPress.
 * @returns The normalized HTML.
 */
function normalizeWpLists(html: string): string {
  if (!html) return html;
  let out = html;

  // Unwrap <p> that directly wraps <ul> or <ol>
  out = out.replace(/<p>\s*(<(?:ul|ol)\b[^>]*>)/gi, "$1");
  out = out.replace(/(<\/(?:ul|ol)>\s*)<\/p>/gi, "$1");

  // Unwrap <p> inside list items: <li><p>text</p></li> -> <li>text</li>
  out = out.replace(/<li>\s*<p>/gi, "<li>");
  out = out.replace(/<\/p>\s*<\/li>/gi, "</li>");

  // Sometimes editors place lists inside blockquotes incorrectly wrapped
  // Keep minimal transformations: do not modify nested structures beyond above rules

  return out;
}

/**
 * Transform WordPress syntax highlighting blocks (hcb_wrap) into standard code blocks
 * Converts: <div class="hcb_wrap"><pre class="prism ... lang-bash" data-lang="Bash"><code>content</code></pre></div>
 * To: <pre data-language="bash"><code>content</code></pre>
 */
function transformSyntaxHighlighting(html: string): string {
  if (!html) return html;
  
  // Match hcb_wrap divs with prism pre elements
  return html.replace(
    /<div\s+class="hcb_wrap"[^>]*>\s*<pre\s+class="[^"]*"\s+data-lang="([^"]*)"[^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>\s*<\/div>/gi,
    (match, lang, code) => {
      // Normalize language name to lowercase for consistency
      const normalizedLang = lang.toLowerCase();
      return `<pre data-language="${normalizedLang}"><code>${code}</code></pre>`;
    }
  );
}

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param input The string to escape.
 * @returns The escaped string.
 */
function escapeRegExp(input: string): string {
  // Escape special regex characters: . * + ? ^ $ { } ( ) | [ ] \
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a unique slug by appending a counter if the base slug already exists.
 * @param baseSlug The desired slug.
 * @param existingSlugs A set of slugs that are already in use.
 * @returns A unique slug.
 */
function generateSlugWithFallback(baseSlug: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;
  
  while (existingSlugs.has(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }
  
  return candidateSlug;
}

/**
 * Checks if a string is an HTTP or HTTPS URL.
 * @param u The string to check.
 * @returns True if the string starts with "http://" or "https://".
 */
function isHttpUrl(u: string): boolean {
  return u.startsWith("http://") || u.startsWith("https://");
}

/**
 * Extracts all potential media URLs from an HTML string.
 * @param html The HTML content to scan.
 * @returns A Set of unique media URLs found in the HTML.
 */
function extractMediaUrlsFromHtml(html: string): Set<string> {
  const urls = new Set<string>();
  if (!html) return urls;

  // Helper to decide if an href should be considered a media asset
  const isLikelyMediaExtension = (url: string): boolean => {
    const ext = getExtensionFromUrl(url);
    // Images
    const image = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"];
    // Video
    const video = ["mp4", "webm", "mov", "m4v"];
    // Audio
    const audio = ["mp3", "ogg", "oga", "wav", "m4a", "aac"];
    // Docs/archives commonly linked for download
    const docs = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "7z", "tar", "gz"];
    return [...image, ...video, ...audio, ...docs].includes(ext);
  };

  // src, data-src, poster on media tags
  const attrPatterns = [
    /\s(?:src|data-src|poster)=["\']([^"\']+)["']/gi,
  ];

  for (const re of attrPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const u = m?.[1] ?? "";
      if (u && isHttpUrl(u) && isLikelyMediaExtension(u)) {
        urls.add(u);
      }
    }
  }

  // srcset handling: URLs separated by commas, with descriptors
  const srcsetRe = /\ssrcset=["\']([^"\']+)["']/gi;
  let sm: RegExpExecArray | null;
  while ((sm = srcsetRe.exec(html)) !== null) {
    const raw = sm?.[1] ?? "";
    if (!raw) continue;
    const parts = raw.split(',');
    for (const part of parts) {
      const urlPart = (part.trim().split(/\s+/)[0] ?? "");
      if (urlPart && isHttpUrl(urlPart)) {
        urls.add(urlPart);
      }
    }
  }

  // <source src="...">
  const sourceRe = /<source\b[^>]*\ssrc=["\']([^"\']+)["'][^>]*>/gi;
  let s: RegExpExecArray | null;
  while ((s = sourceRe.exec(html)) !== null) {
    const u = s?.[1] ?? "";
    if (u && isHttpUrl(u)) {
      urls.add(u);
    }
  }

  // CSS url(...) in style attributes
  const cssUrlRe = /url\( ("|')?(https?:[^"\')]+)\1?\)/gi;
  let c: RegExpExecArray | null;
  while ((c = cssUrlRe.exec(html)) !== null) {
    const u = c?.[2] ?? "";
    if (u && isLikelyMediaExtension(u)) urls.add(u);
  }

  // Anchor hrefs: only consider as media if the href looks like a media/document file
  const hrefRe = /\shref=["\']([^"\']+)["']/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(html)) !== null) {
    const u = hm?.[1] ?? "";
    if (u && isHttpUrl(u) && isLikelyMediaExtension(u)) {
      urls.add(u);
    }
  }

  return urls;
}

/**
 * Main function to import posts, media, and comments from a WordPress WXR file.
 * @param filePath The path to the WXR XML file.
 * @param options Configuration options for the import process.
 * @returns A promise that resolves to an `ImportResult` object summarizing the import.
 */
export async function importWxr(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
  const { 
    dryRun = false, 
    skipMedia = false, 
    verbose = false,
    allowedStatuses = ["publish"],
    purgeBeforeImport = false,
    concurrency = 4,
    allowedHosts = [],
    jobId,
    rebuildExcerpts = false,
  } = options;
  
  // Normalize allowedHosts to accept user-provided values like https://example.com/ or with paths
  const normalizedAllowedHosts = allowedHosts
    .map(h => {
      if (!h) return "";
      let s = h.trim().toLowerCase();
      // Remove protocol
      s = s.replace(/^https?:\/\//, "");
      // Drop everything after first slash (paths)
      const slashIdx = s.indexOf("/");
      if (slashIdx !== -1) s = s.slice(0, slashIdx);
      // Drop leading dots
      s = s.replace(/^\.+/, "");
      return s;
    })
    .filter(Boolean);

  const result: ImportResult = {
    summary: {
      totalItems: 0,
      postsImported: 0,
      attachmentsProcessed: 0,
      redirectsCreated: 0,
      skipped: 0,
    },
    errors: [],
    dryRun,
    mediaUrls: new Map(),
  };

  // Excerpt configuration
  const EXCERPT_MAX = Number(process.env.EXCERPT_MAX_CHARS ?? 220);
  const EXCERPT_ELLIPSIS = process.env.EXCERPT_ELLIPSIS ?? "…";
  const INCLUDE_BLOCK_CODE = String(process.env.EXCERPT_INCLUDE_BLOCK_CODE ?? "false").toLowerCase() === "true";

  // Initialize S3 service if not skipping media
  let s3Service: S3Service | null = null;
  let localService: LocalStorageService | null = null;
  
  if (!skipMedia) {
    const s3Config = getS3Config();
    if (s3Config) {
      s3Service = new S3Service(s3Config);
    } else {
      // Use local storage as fallback for development
      localService = localStorageService;
      if (verbose) console.log("📁 Using local filesystem storage (no S3/R2 configured)");
    }
  }

  /**
   * A simple concurrency limiter to run async tasks in parallel with a controlled limit.
   * @param items The array of items to process.
   * @param limit The maximum number of concurrent workers.
   * @param worker The async function to execute for each item.
   */
  const runWithConcurrency = async <T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> => {
    const results: R[] = new Array(items.length) as R[];
    let i = 0;
    const runners: Promise<void>[] = [];
    const runNext = async () => {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        results[idx] = await worker(items[idx]!, idx);
      } finally {
        await runNext();
      }
    };
    const n = Math.max(1, Math.min(limit, items.length));
    for (let k = 0; k < n; k++) runners.push(runNext());
    await Promise.all(runners);
    return results;
  };

  try {
    // Update job status if provided
    if (jobId && !dryRun) {
      await db.update(importJobs)
        .set({
          status: "running",
          startedAt: sql`now()`,
          updatedAt: sql`now()`
        })
        .where(eq(importJobs.id, jobId));
    }

    // Purge data if requested
    if (purgeBeforeImport && !dryRun) {
      if (verbose) console.log("🗑️ Purging existing data...");
      
      // Delete in correct order to respect foreign keys
      await db.delete(postTags);
      await db.delete(comments);
      await db.delete(posts);
      await db.delete(categories);
      await db.delete(tags);
      await db.delete(redirects);

      // Also purge previously imported media from storage
      try {
        const prefix = "imported-media/";
        // Initialize a storage service if not already prepared (e.g., when skipMedia was true)
        if (!s3Service && !localService) {
          const s3cfg = getS3Config();
          if (s3cfg) s3Service = new S3Service(s3cfg);
          else localService = localStorageService;
        }
        if (s3Service) {
          await s3Service.deletePrefix(prefix);
          if (verbose) console.log("🧹 S3/R2 storage purged:", prefix);
        } else if (localService) {
          await localService.deletePrefix(prefix);
          if (verbose) console.log("🧹 Local storage purged:", prefix);
        }
      } catch (e) {
        if (verbose) console.warn("Warning: failed to purge imported media prefix:", e);
      }

      if (verbose) console.log("✅ Purge completed");
    }

    // Parse XML
    if (verbose) console.log("📖 Parsing WXR file...");
    const xml = await readFile(filePath, "utf-8");
    const doc = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
    
    const items = doc.rss?.channel?.item ?? [];
    const itemArray = Array.isArray(items) ? items : [items];

    result.summary.totalItems = itemArray.length;

    // Debug logging for tests
    if (verbose) {
      console.log("Parsed document structure:", JSON.stringify(doc, null, 2));
      console.log("Items found:", itemArray.length);
    }

    // Parse all items first
    const parsedItems: Array<ParsedPost | ParsedAttachment> = [];
    const existingSlugs = new Set<string>();
    const attachmentIdToUrl = new Map<string, string>(); // attachment ID -> URL

    // Get existing slugs to avoid conflicts
    if (!dryRun) {
      const existingPosts = await db.execute(sql`SELECT slug FROM posts`);
      (existingPosts.rows || []).forEach((row: { slug: string }) => {
        if (row?.slug) existingSlugs.add(row.slug);
      });
    }

    if (verbose) console.log(`📝 Processing ${itemArray.length} items...`);

    for (const item of itemArray) {
      const parsed = parseWxrItem(item);
      if (parsed) {
        // Filter by status for posts
        if (parsed.type === "post") {
          const status = item["wp:status"];
          if (!allowedStatuses.includes(status || "")) {
            result.summary.skipped++;
            continue;
          }
          
          // Ensure unique slug
          parsed.slug = generateSlugWithFallback(parsed.slug, existingSlugs);
          existingSlugs.add(parsed.slug);
        }
        
        // Build attachment map for featured images (post_id -> url)
        if (parsed.type === "attachment") {
          const postId = (item as WxrItem)["wp:post_id"];
          if (postId) {
            attachmentIdToUrl.set(postId, parsed.attachmentUrl);
          }
        }
        
        parsedItems.push(parsed);
      } else {
        result.summary.skipped++;
      }
    }

    // Split items
    const attachmentItems = parsedItems.filter((i): i is ParsedAttachment => i.type === "attachment");
    const postItems = parsedItems.filter((i): i is ParsedPost => i.type === "post");

    // Mark attachments processed (for summary)
    result.summary.attachmentsProcessed = attachmentItems.length;

    // Persist initial job totals for progress (so UI can show a total baseline)
    if (jobId && !dryRun) {
      await db.update(importJobs)
        .set({
          totalItems: result.summary.totalItems,
          attachmentsProcessed: result.summary.attachmentsProcessed,
          skipped: result.summary.skipped,
          updatedAt: sql`now()`,
        })
        .where(eq(importJobs.id, jobId));
    }

    // Pre-process posts to expand shortcodes and collect all media URLs.
    // This ensures that media from expanded shortcodes (e.g., galleries) is included before download.
    const processedPostContent = new Map<string, string>(); // guid -> expanded HTML

    if (!skipMedia && (s3Service || localService)) {
      const allMedia = new Set<string>();
      if (verbose) console.log("🔍 Expanding shortcodes and scanning for media in all posts...");

      // Add attachment URLs first
      for (const a of attachmentItems) {
        if (a.attachmentUrl) allMedia.add(a.attachmentUrl);
      }

      // Then process posts: expand shortcodes, store the result, and collect media URLs
      for (const p of postItems) {
        const expandedHtml = expandShortcodes(p.html);
        processedPostContent.set(p.importedSystemId, expandedHtml);
        for (const u of extractMediaUrlsFromHtml(expandedHtml)) {
          allMedia.add(u);
        }
      }

      const medias = Array.from(allMedia);
      if (verbose && medias.length) console.log(`📥 Downloading ${medias.length} media files (concurrency=${concurrency})...`);

      await runWithConcurrency(medias, concurrency, async (url) => {
        try {
          if (!result.mediaUrls.has(url)) {
            const newUrl = await downloadMedia(url, s3Service, localService, normalizedAllowedHosts, { dryRun, verbose });
            if (newUrl) result.mediaUrls.set(url, newUrl);
          }
        } catch (e) {
          if (verbose) console.warn("Media download failed:", url, e);
        }
        return undefined as unknown as void;
      });
    } else {
      // If skipping media, we still need to expand shortcodes for consistent processing in the main loop.
      if (verbose) console.log("🔍 Expanding shortcodes for all posts (media download skipped)...");
      for (const p of postItems) {
        processedPostContent.set(p.importedSystemId, expandShortcodes(p.html));
      }
    }

    if (verbose && postItems.length > 0) {
      console.log(`📄 Processing ${postItems.length} posts...`);
    }

    // In-memory caches to reduce DB chatter
    const authorCache = new Map<string, string>(); // author login/name -> userId
    const categoryCache = new Map<string, string>(); // slug -> id
    const tagCache = new Map<string, string>(); // slug -> id

    for (const post of postItems) {
      try {
        // Prepare HTML: expand shortcodes, normalize lists, transform syntax highlighting, sanitize, then rewrite media URLs
        const expanded = processedPostContent.get(post.importedSystemId) || "";
        const withIframes = transformIframeVideos(expanded);
        const normalized = normalizeWpLists(withIframes);
        const withSyntaxHighlighting = transformSyntaxHighlighting(normalized);

        // Compute excerpt BEFORE sanitize to preserve <!--more--> markers if any
        const computedExcerpt = generateExcerpt(withSyntaxHighlighting, {
          maxChars: EXCERPT_MAX,
          ellipsis: EXCERPT_ELLIPSIS,
          dropBlockCode: !INCLUDE_BLOCK_CODE,
        });

        const sanitized = sanitizeHtml(withSyntaxHighlighting);
        const finalHtml = rewriteMediaUrls(sanitized, result.mediaUrls);

        // Handle featured image
        let featuredImageUrl: string | undefined;
        let featuredImageAlt: string | undefined = undefined;
        if (post.featuredImageId && attachmentIdToUrl.has(post.featuredImageId)) {
          const originalUrl = attachmentIdToUrl.get(post.featuredImageId)!;
          featuredImageUrl = result.mediaUrls.get(originalUrl) || originalUrl;
        }

        // Fallback: if no featuredImageUrl resolved via attachment meta, pick first image in content
        if (!featuredImageUrl) {
          // Prefer an anchor-wrapped image's href if it looks like an image; else use the img src
            const anchorImgRe = /<a[^>]*href=["\']([^"\']+)["'][^>]*>\s*<img[^>]*src=["\']([^"\']+)["'][^>]*alt=["\']([^"\']*)["'][^>]*>\s*<\/a>/i;
            const imgRe = /<img[^>]*src=["\']([^"\']+)["'][^>]*alt=["\']([^"\']*)["'][^>]*>/i;
            const m = anchorImgRe.exec(finalHtml);
            if (m) {
              const href = m[1] ?? "";
              const imgSrc = m[2] ?? "";
              const alt = m[3];
              featuredImageUrl = choosePreferredImageUrl(href, imgSrc);
              if (alt && alt.trim().length > 0) featuredImageAlt = alt.trim();
            } else {
              const im = imgRe.exec(finalHtml);
              if (im) {
                featuredImageUrl = im[1];
                const alt = im[2];
                if (alt && alt.trim().length > 0) featuredImageAlt = alt.trim();
              }
            }
            // As a last resort, use post title if alt still empty
            if (!featuredImageAlt && featuredImageUrl) {
              featuredImageAlt = post.title;
            }
        }

        if (!dryRun) {
          await db.transaction(async (tx) => {
            // Get or create author (cache by login/name)
            let authorId: string | undefined = authorCache.get(post.author);
            if (!authorId) {
              const authorRows = await tx.insert(users).values({
                login: post.author,
                name: post.author,
                email: `${post.author}@imported.local`,
              }).onConflictDoUpdate({ target: users.login, set: { name: post.author } }).returning();
              authorId = authorRows?.[0]?.id;
              if (authorId) authorCache.set(post.author, authorId);
            }

            // Upsert categories (use cache per slug)
            let primaryCategoryId: string | null = null;
            if (post.categories.length > 0) {
              // Resolve from cache first
              const missingCats = post.categories.filter(c => !categoryCache.has(c.slug));
              for (const c of missingCats) {
                const catRows = await tx.insert(categories).values({ name: c.name, slug: c.slug })
                  .onConflictDoUpdate({ target: categories.slug, set: { name: c.name } })
                  .returning();
                if (catRows?.[0]?.id) categoryCache.set(c.slug, catRows[0].id);
              }
              // Determine primary as first declared
              const firstSlug = post.categories[0]?.slug;
              primaryCategoryId = firstSlug ? (categoryCache.get(firstSlug) ?? null) : null;
            }

            // Upsert tags (use cache per slug)
            const tagIds: string[] = [];
            if (post.tags.length > 0) {
              const missingTags = post.tags.filter(t => !tagCache.has(t.slug));
              for (const t of missingTags) {
                const tagRows = await tx.insert(tags).values({ name: t.name, slug: t.slug })
                  .onConflictDoUpdate({ target: tags.slug, set: { name: t.name } })
                  .returning();
                if (tagRows?.[0]?.id) tagCache.set(t.slug, tagRows[0].id);
              }
              for (const t of post.tags) {
                const id = tagCache.get(t.slug);
                if (id) tagIds.push(id);
              }
            }

            // Determine whether to recompute excerpt on update by checking existing row
            const existing = await tx.select({ id: posts.id, html: posts.html, excerpt: posts.excerpt })
              .from(posts)
              .where(eq(posts.importedSystemId, post.importedSystemId))
              .limit(1);
            const existingRow = existing[0];

            const htmlChanged = !!existingRow && (existingRow.html ?? "") !== finalHtml;
            const hadExcerpt = !!(existingRow?.excerpt && existingRow.excerpt.trim().length > 0);
            const shouldRecompute = rebuildExcerpts || !hadExcerpt || htmlChanged;

            const excerptToUse = shouldRecompute ? (computedExcerpt || null) : (existingRow?.excerpt ?? computedExcerpt ?? null);

            // Insert or update post using importedSystemId for idempotency
            const insertedPost = await tx.insert(posts).values({
              slug: post.slug,
              title: post.title,
              html: finalHtml,
              bodyHtml: finalHtml,
              bodyMd: null,
              excerpt: excerptToUse,
              importedSystemId: post.importedSystemId,
              publishedAt: post.publishedAt || null,
              categoryId: primaryCategoryId,
              featuredImageUrl,
              featuredImageAlt,
            }).onConflictDoUpdate({
              target: posts.importedSystemId,
              set: {
                title: post.title,
                html: finalHtml,
                bodyHtml: finalHtml,
                excerpt: excerptToUse,
                publishedAt: post.publishedAt || null,
                categoryId: primaryCategoryId,
                featuredImageUrl,
                featuredImageAlt,
                updatedAt: sql`now()`,
              },
            }).returning();

            const postId = insertedPost?.[0]?.id;
            if (!postId) throw new Error("Failed to upsert post");

            // Refresh post-tags: replace associations
            await tx.delete(postTags).where(eq(postTags.postId, postId));
            for (const tagId of tagIds) {
              await tx.insert(postTags).values({ postId, tagId }).onConflictDoNothing();
            }

            // Create redirect if we have an original URL
            if (post.originalUrl) {
              try {
                const url = new URL(post.originalUrl);
                const fromPath = url.pathname;
                const toPath = `/posts/${post.slug}`;
                if (fromPath !== toPath) {
                  await tx.insert(redirects).values({ fromPath, toPath, status: 301 })
                    .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath, status: 301 } });
                  result.summary.redirectsCreated++;
                }
              } catch {
                // ignore invalid redirect URL
              }
            }

            // Process comments with idempotency and parent caching
            if (post.comments.length > 0) {
              // Build set of existing paths to avoid duplicates on re-import
              const existing = await tx.select({ id: comments.id, path: comments.path, depth: comments.depth })
                .from(comments)
                .where(eq(comments.postId, postId));
              const existingPaths = new Set(existing.map(r => r.path));
              const existingByPath = new Map(existing.map(r => [r.path, { id: r.id, depth: r.depth, path: r.path }]));

              // Map original comment id -> inserted { id, path, depth }
              const insertedMap = new Map<string, { id: string; path: string; depth: number }>();

              // We'll iteratively insert comments whose parents are resolved
              const remaining = post.comments.filter(c => c.approved).slice();
              const maxIterations = remaining.length + 5;
              let iterations = 0;
              while (remaining.length > 0 && iterations < maxIterations) {
                iterations++;
                let progressed = false;

                for (let idx = 0; idx < remaining.length; ) {
                  const c = remaining[idx]!;

                  // Resolve parent if any
                  let parentInfo: { id: string; path: string; depth: number } | null = null;
                  if (c.parentId) {
                    // If parent inserted in this run
                    const ins = insertedMap.get(c.parentId);
                    if (ins) parentInfo = ins;
                    else {
                      // If parent existed already, its path ends with the parent's original ID
                      // We can find by scanning existing paths for those that end with `.${parentId}` or equal to parentId
                      const parentPath = Array.from(existingPaths).find(p => p === c.parentId || p.endsWith(`.${c.parentId}`));
                      if (parentPath) {
                        const e = existingByPath.get(parentPath);
                        if (e) parentInfo = e;
                      }
                    }

                    // If parent unresolved yet, skip this round
                    if (!parentInfo) { idx++; continue; }
                  }

                  // Compute this comment path/depth
                  const basePath = parentInfo?.path ?? "";
                  const path = basePath ? `${basePath}.${c.id}` : c.id;
                  const depth = (parentInfo?.depth ?? 0) + (parentInfo ? 1 : 0);

                  // Idempotency: skip if path already exists
                  if (existingPaths.has(path)) {
                    // Map to existing id for children
                    const e = existingByPath.get(path);
                    if (e) insertedMap.set(c.id, e);
                    remaining.splice(idx, 1);
                    progressed = true;
                    continue;
                  }

                  // Upsert/create comment author if available
                  let commentUserId: string | null = null;
                  if (c.authorEmail) {
                    const userRows = await tx.insert(users).values({ email: c.authorEmail, name: c.author })
                      .onConflictDoUpdate({ target: users.email, set: { name: c.author } })
                      .returning();
                    commentUserId = userRows?.[0]?.id ?? null;
                  }

                  // Insert comment
                  const inserted = await tx.insert(comments).values({
                    postId,
                    userId: commentUserId,
                    parentId: parentInfo?.id ?? null,
                    path,
                    depth,
                    bodyHtml: sanitizeHtml(c.content),
                    bodyMd: null,
                    status: "approved",
                    createdAt: c.date || null,
                  }).returning();

                  if (inserted?.[0]) {
                    const info = { id: inserted[0].id, path, depth };
                    insertedMap.set(c.id, info);
                    existingPaths.add(path);
                    existingByPath.set(path, info);
                  }

                  remaining.splice(idx, 1);
                  progressed = true;
                }

                if (!progressed) break; // Avoid infinite loop on malformed trees
              }
            }
          });
        }

        result.summary.postsImported++;

        // Persist incremental progress so UI polling updates the bar
        if (jobId && !dryRun) {
          await db.update(importJobs)
            .set({
              postsImported: result.summary.postsImported,
              redirectsCreated: result.summary.redirectsCreated,
              updatedAt: sql`now()`,
            })
            .where(eq(importJobs.id, jobId));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({
          item: post.importedSystemId,
          error: `Post import failed: ${errorMsg}`
        });

        if (jobId && !dryRun) {
          await db.insert(importJobErrors).values({
            jobId,
            itemIdentifier: post.importedSystemId,
            errorType: "post_import",
            errorMessage: errorMsg,
            itemData: { title: post.title, slug: post.slug }
          });
        }
      }
    }

    // Update job completion
    if (jobId && !dryRun) {
      await db.update(importJobs)
        .set({
          status: result.errors.length > 0 ? "failed" : "completed",
          finishedAt: sql`now()`,
          updatedAt: sql`now()`,
          totalItems: result.summary.totalItems,
          postsImported: result.summary.postsImported,
          attachmentsProcessed: result.summary.attachmentsProcessed,
          redirectsCreated: result.summary.redirectsCreated,
          skipped: result.summary.skipped,
        })
        .where(eq(importJobs.id, jobId));
    }

  } catch (error) {
    // Handle fatal errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push({
      item: "FATAL",
      error: errorMsg
    });

    if (jobId && !dryRun) {
      await db.update(importJobs)
        .set({
          status: "failed",
          finishedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(importJobs.id, jobId));

      await db.insert(importJobErrors).values({
        jobId,
        itemIdentifier: "FATAL",
        errorType: "fatal_error",
        errorMessage: errorMsg,
        itemData: { filePath }
      });
    }
  }

  return result;
}

async function run() {
  const args = process.argv.slice(2);
  const pathArg = args.find(a => a.startsWith("path="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");
  const skipMedia = args.includes("--skip-media");
  const verbose = args.includes("--verbose");
  const rebuildExcerpts = args.includes("--rebuild-excerpts");
  const allowedHostsArg = args.find(a => a.startsWith("allowedHosts="))?.split("=")[1] ?? "";
  const concurrencyArg = args.find(a => a.startsWith("concurrency="))?.split("=")[1] ?? "";
  const allowedHosts = allowedHostsArg
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const concurrency = Number.isFinite(Number(concurrencyArg)) && Number(concurrencyArg) > 0
    ? Number(concurrencyArg)
    : undefined;

  if (!pathArg) {
    console.error("Usage: npx tsx scripts/import-wxr.ts path=./export.xml [--dry-run] [--skip-media] [--verbose] [--rebuild-excerpts] [allowedHosts=example.com,cdn.example.com] [concurrency=8]");
    process.exit(1);
  }

  console.log(`Starting WXR import from: ${pathArg}`);
  if (dryRun) console.log("🏃 DRY RUN MODE - No changes will be made");
  if (skipMedia) console.log("📷 SKIP MEDIA MODE - Media will not be downloaded");
  if (allowedHosts.length > 0) console.log(`🔒 Allowed media hosts: ${allowedHosts.join(", ")}`);
  if (concurrency) console.log(`🧵 Concurrency: ${concurrency}`);
  if (rebuildExcerpts) console.log("📝 Rebuilding excerpts for all posts");

  const startTime = Date.now();
  const opts: ImportOptions = { dryRun, skipMedia, verbose, allowedHosts, rebuildExcerpts };
  if (typeof concurrency === "number") {
    opts.concurrency = concurrency;
  }
  const result = await importWxr(pathArg, opts);
  const duration = Date.now() - startTime;

  console.log("\n📊 Import Summary:");
  console.log(`   Total items: ${result.summary.totalItems}`);
  console.log(`   Posts imported: ${result.summary.postsImported}`);
  console.log(`   Attachments processed: ${result.summary.attachmentsProcessed}`);
  console.log(`   Redirects created: ${result.summary.redirectsCreated}`);
  console.log(`   Skipped: ${result.summary.skipped}`);
  console.log(`   Duration: ${duration}ms`);

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    result.errors.forEach(error => {
      console.log(`   ${error.item}: ${error.error}`);
    });
  }

  if (result.mediaUrls.size > 0) {
    console.log(`\n📷 Media URLs remapped: ${result.mediaUrls.size}`);
    if (verbose) {
      for (const [oldUrl, newUrl] of result.mediaUrls) {
        console.log(`   ${oldUrl} -> ${newUrl}`);
      }
    }
  }

  // Create checkpoint file
  const checkpointData = {
    timestamp: new Date().toISOString(),
    file: pathArg,
    result: result.summary,
    errors: result.errors,
  };

  const checkpointPath = `${pathArg}.checkpoint.json`;
  await writeFile(checkpointPath, JSON.stringify(checkpointData, null, 2));
  console.log(`\n💾 Checkpoint saved to: ${checkpointPath}`);

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(e => {
    console.error("💥 Import failed:", e);
    process.exit(1);
  });
}

/**
 * Transforms `<iframe>` tags pointing to video files into native `<video>` tags.
 * It preserves YouTube iframes to allow direct embedding.
 * @param html The HTML content to transform.
 * @returns The transformed HTML.
 */
function transformIframeVideos(html: string): string {
  if (!html) return html;
  return html.replace(/<iframe([^>]*)>\s*<\/iframe>/gi, (m, attrs) => {
    const srcMatch = attrs.match(/\ssrc=["\']([^"\']+)["']/i);
    const src = srcMatch?.[1] || "";
    if (!src) return m;
    try {
      const u = new URL(src, "https://example.com");
      const host = u.hostname.toLowerCase();
      const isYouTube = /(^|\.)youtube\.com$/.test(host) || /(^|\.)youtu\.be$/.test(host) || /(^|\.)youtube-nocookie\.com$/.test(host);
      if (isYouTube) {
        // Keep YouTube iframe as-is so it plays from YouTube directly
        return m;
      }
      const ext = getExtensionFromUrl(src);
      const videoExts = new Set(["mp4", "webm", "mov", "m4v"]);
      if (videoExts.has(ext)) {
        const escaped = src.replace(/"/g, "&quot;");
        return `<video controls preload="metadata" src="${escaped}"></video>`;
      }
      // Not a direct video file; leave as-is (sanitizer may drop non-YouTube iframes)
      return m;
    } catch {
      return m;
    }
  });
}

/**
 * Helper to choose the best image URL, preferring a full-size version over a thumbnail.
 * WordPress often links a thumbnail to the full-size image. This function prefers the link's `href`.
 * @param anchorHref The `href` attribute of a surrounding `<a>` tag.
 * @param imgSrc The `src` attribute of the `<img>` tag.
 * @returns The preferred image URL, or undefined if none are available.
 */
function choosePreferredImageUrl(anchorHref?: string, imgSrc?: string): string | undefined {
  // Gracefully handle absent values
  if (!anchorHref && !imgSrc) return undefined;
  const sizeSuffixRe = /(.*)-\d+x\d+(\.[a-z0-9]+)$/i;
  const a = anchorHref ?? "";
  const i = imgSrc ?? "";
  const aHas = sizeSuffixRe.test(a);
  const iHas = sizeSuffixRe.test(i);
  // Prefer anchor when it appears to be the full-size version
  if (iHas && !aHas && a) return a;
  if (!aHas && iHas && a) return a; // same condition kept for clarity
  // Fall back to whichever is available
  return a || i || undefined;
}
