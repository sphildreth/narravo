// SPDX-License-Identifier: Apache-2.0
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

/**
 * Gutenberg block wrapper remover.
 * Strips <!-- wp:* --> and <!-- /wp:* --> comments while preserving inner HTML.
 * Safe fallback for importers that don't interpret blocks semantically.
 */
function stripGutenbergBlockComments(html: string): string {
  if (!html) return html;
  return html
    // Remove opening/closing block comments but keep everything between them
    .replace(/<!--\s*\/?wp:[\s\S]*?-->\s*/g, "");
}

/**
 * Quicktags handler.
 * - <!--more-->: returns excerpt (text before) if none provided, removes the marker from HTML.
 * - <!--nextpage-->: replaces with a marker <hr data-wp-nextpage="true" /> to preserve intent.
 */

function applyQuicktags(html: string): { html: string; excerptFromMore?: string; pageBreaks: number } {
  if (!html) return { html, pageBreaks: 0 };
  let excerptFromMoreValue: string | undefined;
  let pageBreaks = 0;

  if (html.includes("<!--more-->")) {
    const idx = html.indexOf("<!--more-->");
    const before = idx >= 0 ? html.slice(0, idx) : "";
    const after = idx >= 0 ? html.slice(idx + "<!--more-->".length) : "";
    excerptFromMoreValue = before.trim();
    html = (before + after);
  }

  html = html.replace(/<!--\s*nextpage\s*-->/gi, () => {
    pageBreaks += 1;
    return '<hr data-wp-nextpage="true" />';
  });

  const base = { html, pageBreaks };
  return excerptFromMoreValue !== undefined ? { ...base, excerptFromMore: excerptFromMoreValue } : base;
}

/**
 * Minimal auto-embed detection.
 * Converts standalone YouTube/Vimeo URLs (or [embed]URL[/embed]) on their own line into
 * <a class="wp-embed" data-embed="provider" href="...">...</a>
 * This avoids sanitizer iframe stripping while preserving intent for the renderer.
 */
function transformAutoEmbeds(html: string): string {
  if (!html) return html;

  const lineEmbed = (url: string) => {
    const u = url.trim();
    let provider: string | null = null;
    if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u)) provider = "youtube";
    else if (/^(https?:\/\/)?(player\.)?vimeo\.com\//i.test(u)) provider = "vimeo";
    else provider = null;
    if (!provider) return url;
    const escaped = u.replace(/"/g, "&quot;");
    return `<p><a class="wp-embed" data-embed="${provider}" href="${escaped}">${escaped}</a></p>`;
  };

  // [embed]URL[/embed] -> embedded anchor
  html = html.replace(/\[embed\]([\s\S]*?)\[\/embed\]/gi, (_, url) => lineEmbed(url));

  // Standalone provider URLs: detect URLs that are in their own paragraph or on separate lines.
  html = html.replace(
    /(?:^|\n|\r|\r\n)\s*(https?:\/\/[^\s<>"']+)\s*(?=$|\n|\r|\r\n)/g,
    (m, url) => "\n" + lineEmbed(url)
  );

  return html;
}

/**
 * Minimal shortcode helpers.
 * - [caption] <img ... /> Caption text [/caption] -> <figure><img ... /><figcaption>Caption text</figcaption></figure>
 * Leaves unknown shortcodes intact to avoid data loss.
 */
function transformBasicShortcodes(html: string): string {
  if (!html) return html;
  // naive [caption] transform
  html = html.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, (_m, inner) => {
    // Try to split out the first <img ...>
    const imgMatch = inner.match(/<img[\s\S]*?>/i);
    if (!imgMatch) return inner; // fallback
    const img = imgMatch[0];
    const rest = inner.replace(img, "").trim();
    const caption = rest ? `<figcaption>${rest}</figcaption>` : "";
    return `<figure class="wp-caption">${img}${caption}</figure>`;
  });
  return html;
}

/**
 * Utility to safely set excerpt if missing.
 */
function chooseExcerpt(existing: string | undefined, excerptFromMore?: string): string | undefined {
  if (existing && existing.trim().length > 0) return existing;
  if (excerptFromMore && excerptFromMore.trim().length > 0) return excerptFromMore;
  return existing;
}

// --- Enhanced content processing pipeline additions ---
interface EmbedOptions {
  allowedEmbedHosts?: string[]; // informational for renderers; sanitization still happens downstream
}

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

export interface ParsedPost {
  type: "post";
  guid: string;
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

export interface ParsedAttachment {
  type: "attachment";
  guid: string;
  title: string;
  attachmentUrl: string;
  alt?: string | undefined;
}

export interface ImportOptions {
  dryRun?: boolean;
  skipMedia?: boolean;
  verbose?: boolean;
  allowedStatuses?: string[];
  purgeBeforeImport?: boolean;
  concurrency?: number;
  allowedHosts?: string[];
  jobId?: string;
}

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

export function parseWxrItem(item: WxrItem): ParsedPost | ParsedAttachment | null {
  const postType = item["wp:post_type"];

  // Extract GUID
  let guid: string;
  if (typeof item.guid === "string") {
    guid = item.guid;
  } else if (item.guid && typeof item.guid === "object" && item.guid._) {
    guid = item.guid._;
  } else {
    return null; // No GUID, skip
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
      guid,
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
      guid,
      title: item.title || "Untitled",
      attachmentUrl: item["wp:attachment_url"] || "",
      alt,
    };
  }

  return null; // Skip other post types
}

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
    if (allowedHosts.length > 0 && !allowedHosts.includes(urlObj.hostname)) {
      throw new Error(`Host ${urlObj.hostname} not in allowlist`);
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

// Normalize common WordPress list markup issues prior to sanitization
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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function isHttpUrl(u: string): boolean {
  return u.startsWith("http://") || u.startsWith("https://");
}

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
    /\s(?:src|data-src|poster)=["']([^"']+)["']/gi,
  ];

  for (const re of attrPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const u = m?.[1] ?? "";
      if (u && isHttpUrl(u)) {
        urls.add(u);
      }
    }
  }

  // srcset handling: URLs separated by commas, with descriptors
  const srcsetRe = /\ssrcset=["']([^"']+)["']/gi;
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
  const sourceRe = /<source\b[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  let s: RegExpExecArray | null;
  while ((s = sourceRe.exec(html)) !== null) {
    const u = s?.[1] ?? "";
    if (u && isHttpUrl(u)) {
      urls.add(u);
    }
  }

  // CSS url(...) in style attributes
  const cssUrlRe = /url\(("|')?(https?:[^"')]+)\1?\)/gi;
  let c: RegExpExecArray | null;
  while ((c = cssUrlRe.exec(html)) !== null) {
    const u = c?.[2] ?? "";
    if (u) urls.add(u);
  }

  // Anchor hrefs: only consider as media if the href looks like a media/document file
  const hrefRe = /\shref=["']([^"']+)["']/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(html)) !== null) {
    const u = hm?.[1] ?? "";
    if (u && isHttpUrl(u) && isLikelyMediaExtension(u)) {
      urls.add(u);
    }
  }

  return urls;
}

export async function importWxr(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
  const { 
    dryRun = false, 
    skipMedia = false, 
    verbose = false,
    allowedStatuses = ["publish"],
    purgeBeforeImport = false,
    concurrency = 4,
    allowedHosts = [],
    jobId
  } = options;
  
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

  // Simple concurrency limiter
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
      (existingPosts.rows || []).forEach((row: any) => {
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
          const postId = (item as any)["wp:post_id"];
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

    // Pre-collect all media URLs (attachments + referenced in posts), then download with concurrency & dedupe
    if (!skipMedia && (s3Service || localService)) {
      const allMedia = new Set<string>();
      // Attachment direct URLs
      for (const a of attachmentItems) {
        if (a.attachmentUrl) allMedia.add(a.attachmentUrl);
      }
      // Media referenced in posts
      for (const p of postItems) {
        for (const u of extractMediaUrlsFromHtml(p.html)) {
          allMedia.add(u);
        }
      }

      const medias = Array.from(allMedia);
      if (verbose && medias.length) console.log(`📥 Downloading ${medias.length} media files (concurrency=${concurrency})...`);

      await runWithConcurrency(medias, concurrency, async (url) => {
        try {
          if (!result.mediaUrls.has(url)) {
            const newUrl = await downloadMedia(url, s3Service, localService, allowedHosts, { dryRun, verbose });
            if (newUrl) result.mediaUrls.set(url, newUrl);
          }
        } catch (e) {
          if (verbose) console.warn("Media download failed:", url, e);
        }
        return undefined as unknown as void;
      });
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
        // Prepare HTML: expand shortcodes, normalize lists, sanitize, then rewrite media URLs
        const expanded = expandShortcodes(post.html);
        const normalized = normalizeWpLists(expanded);
        const sanitized = sanitizeHtml(normalized);
        const finalHtml = rewriteMediaUrls(sanitized, result.mediaUrls);

        // Handle featured image
        let featuredImageUrl: string | undefined;
        let featuredImageAlt: string | undefined = undefined;
        if (post.featuredImageId && attachmentIdToUrl.has(post.featuredImageId)) {
          const originalUrl = attachmentIdToUrl.get(post.featuredImageId)!;
          featuredImageUrl = result.mediaUrls.get(originalUrl) || originalUrl;
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

            // Insert or update post using GUID for idempotency
            const insertedPost = await tx.insert(posts).values({
              slug: post.slug,
              title: post.title,
              html: finalHtml,
              bodyHtml: finalHtml,
              bodyMd: null,
              excerpt: post.excerpt || null,
              guid: post.guid,
              publishedAt: post.publishedAt || null,
              categoryId: primaryCategoryId,
              featuredImageUrl,
              featuredImageAlt,
            }).onConflictDoUpdate({
              target: posts.guid,
              set: {
                title: post.title,
                html: finalHtml,
                bodyHtml: finalHtml,
                excerpt: post.excerpt || null,
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
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({
          item: post.guid,
          error: `Post import failed: ${errorMsg}`
        });

        if (jobId && !dryRun) {
          await db.insert(importJobErrors).values({
            jobId,
            itemIdentifier: post.guid,
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
    console.error("Usage: npx tsx scripts/import-wxr.ts path=./export.xml [--dry-run] [--skip-media] [--verbose] [allowedHosts=example.com,cdn.example.com] [concurrency=8]");
    process.exit(1);
  }

  console.log(`Starting WXR import from: ${pathArg}`);
  if (dryRun) console.log("🏃 DRY RUN MODE - No changes will be made");
  if (skipMedia) console.log("📷 SKIP MEDIA MODE - Media will not be downloaded");
  if (allowedHosts.length > 0) console.log(`🔒 Allowed media hosts: ${allowedHosts.join(", ")}`);
  if (concurrency) console.log(`🧵 Concurrency: ${concurrency}`);

  const startTime = Date.now();
  const opts: ImportOptions = { dryRun, skipMedia, verbose, allowedHosts };
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
 * Transform [audio], [video], + [playlist] shortcodes into semantic placeholders.
 * We avoid raw <audio>/<video> (sanitizers can strip sources/posters) + instead emit
 * a minimal container your renderer can hydrate.
 * Supported attrs: src, poster, loop, autoplay, preload, width, height; playlist: ids.
 */
function transformAvShortcodes(html: string): string {
  if (!html) return html;

  // [audio src="..."]
  html = html.replace(/\[audio\b([^\]]*)\]/gi, (_m, attrs) => {
    const src = (attrs.match(/src="([^"]+)"/i)?.[1]) || "";
    const preload = attrs.match(/preload="(auto|metadata|none)"/i)?.[1];
    const loop = /(?:^|\s)loop(?:\s|$|=|")/i.test(attrs);
    const autoplay = /(?:^|\s)autoplay(?:\s|$|=|")/i.test(attrs);
    const meta = [
      src ? `data-src="${src.replace(/"/g, "&quot;")}"` : "",
      preload ? `data-preload="${preload}"` : "",
      loop ? `data-loop="true"` : "",
      autoplay ? `data-autoplay="true"` : ""
    ].filter(Boolean).join(" ");
    return `<div class="wp-audio"${meta ? " " + meta : ""}></div>`;
  });

  // [video src="..." poster="..."]
  html = html.replace(/\[video\b([^\]]*)\]/gi, (_m, attrs) => {
    const src = (attrs.match(/src="([^"]+)"/i)?.[1]) || "";
    const poster = (attrs.match(/poster="([^"]+)"/i)?.[1]) || "";
    const width = (attrs.match(/width="(\d+)"/i)?.[1]) || "";
    const height = (attrs.match(/height="(\d+)"/i)?.[1]) || "";
    const preload = attrs.match(/preload="(auto|metadata|none)"/i)?.[1];
    const loop = /(?:^|\s)loop(?:\s|$|=|")/i.test(attrs);
    const autoplay = /(?:^|\s)autoplay(?:\s|$|=|")/i.test(attrs);
    const meta = [
      src ? `data-src="${src.replace(/"/g, "&quot;")}"` : "",
      poster ? `data-poster="${poster.replace(/"/g, "&quot;")}"` : "",
      width ? `data-width="${width}"` : "",
      height ? `data-height="${height}"` : "",
      preload ? `data-preload="${preload}"` : "",
      loop ? `data-loop="true"` : "",
      autoplay ? `data-autoplay="true"` : ""
    ].filter(Boolean).join(" ");
    return `<div class="wp-video"${meta ? " " + meta : ""}></div>`;
  });

  // [playlist ids="1,2,3" type="audio|video"]
  html = html.replace(/\[playlist\b([^\]]*)\]/gi, (_m, attrs) => {
    const ids = (attrs.match(/ids="([^"]+)"/i)?.[1] || "")
      .split(",").map((s: string) => s.trim()).filter(Boolean);
    const type = (attrs.match(/type="(audio|video)"/i)?.[1]) || "audio";
    const meta = [
      ids.length ? `data-ids="${ids.join(",")}"` : "",
      `data-type="${type}"`
    ].filter(Boolean).join(" ");
    return `<div class="wp-playlist"${meta ? " " + meta : ""}></div>`;
  });

  return html;
}

/**
 * Minimal parser for a few high-value Gutenberg blocks:
 * - wp:image {...} innerHTML -> <figure class="wp-image" data-id="ID" data-size="SIZE">innerHTML</figure>
 * - wp:embed {"url":"..."}   -> <p><a class="wp-embed" data-embed="provider" href="url">url</a></p>
 * - wp:gallery {"ids":[...]} -> <div class="wp-gallery-placeholder" data-wp-gallery-ids="..."></div>
 * We read JSON attributes from the opening comment and preserve inner HTML when useful.
 */
function transformCoreBlocks(html: string): string {
  if (!html) return html;

  // General matcher: <!-- wp:TYPE {JSON}? --> ... <!-- /wp:TYPE -->
  return html.replace(/<!--\s*wp:([a-z\/-]+)(\s+(\{[\s\S]*?\}))?\s*-->([\s\S]*?)<!--\s*\/wp:\1\s*-->/gi,
    (_m, type, _jsonAll, jsonStr, inner) => {
      const json = (() => { try { return jsonStr ? JSON.parse(jsonStr) : {}; } catch { return {}; } })();
      const t = String(type).toLowerCase();

      if (t === "image") {
        const id = json?.id ?? json?.attachmentId;
        const size = json?.sizeSlug || json?.size;
        const meta = [
          id ? `data-id="${id}"` : "",
          size ? `data-size="${size}"` : ""
        ].filter(Boolean).join(" ");
        return `<figure class="wp-image"${meta ? " " + meta : ""}>${inner}</figure>`;
      }

      if (t === "embed") {
        const url = json?.url || inner.trim();
        if (!url) return inner;
        let provider: string | null = null;
        if (/youtube\.com|youtu\.be/i.test(url)) provider = "youtube";
        else if (/vimeo\.com/i.test(url)) provider = "vimeo";
        else if (/soundcloud\.com|w\.soundcloud\.com/i.test(url)) provider = "soundcloud";
        const escaped = String(url).replace(/"/g, "&quot;");
        if (provider) return `<p><a class="wp-embed" data-embed="${provider}" href="${escaped}">${escaped}</a></p>`;
        return `<p><a class="wp-embed" href="${escaped}">${escaped}</a></p>`;
      }

      if (t === "gallery") {
        const ids = Array.isArray(json?.ids) ? json.ids : [];
        const columns = json?.columns;
        const meta = [
          ids.length ? `data-wp-gallery-ids="${ids.join(",")}"` : "",
          columns ? `data-wp-gallery-columns="${columns}"` : ""
        ].filter(Boolean).join(" ");
        return `<div class="wp-gallery-placeholder"${meta ? " " + meta : ""}></div>`;
      }

      // Unknown core block: drop wrappers but keep inner
      return inner;
    }
  );
}

/**
 * Post-save resolver: replace internal-ID annotations with final URLs once all slugs/media URLs exist.
 * Provide maps: postIdToSlug: { [id: string]: "slug" }, attachmentIdToUrl: { [id: string]: "https://..." }
 */
export function resolveInternalLinks(html: string, postIdToSlug: Record<string, string>, attachmentIdToUrl: Record<string, string>): string {
  if (!html) return html;
  // Replace data-wp-post-id
  html = html.replace(/<a([^>]+)data-wp-post-id="(\d+)"([^>]*)>/gi, (m, pre, id, post) => {
    const slug = postIdToSlug[String(id)];
    if (!slug) return m;
    const newHref = `/posts/${slug}`;
    return `<a${pre}href="${newHref}"${post}>`;
  });
  // Replace data-wp-attachment-id
  html = html.replace(/<a([^>]+)data-wp-attachment-id="(\d+)"([^>]*)>/gi, (m, pre, id, post) => {
    const url = attachmentIdToUrl[String(id)];
    if (!url) return m;
    return `<a${pre}href="${url}"${post}>`;
  });
  return html;
}

/**
 * Allowlist iframe hosts by converting matching iframes into placeholders
 * your renderer can hydrate back to iframes post-sanitization.
 */
function allowlistIframes(html: string, hosts: string[] = []): string {
  if (!html || hosts.length === 0) return html;
  const hostRe = new RegExp("(" + hosts.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "i");
  return html.replace(/<iframe[^>]*src="([^"]+)"[^>]*>\s*<\/iframe>/gi, (m, src) => {
    try {
      const u = new URL(src, "https://example.com");
      if (hostRe.test(u.hostname)) {
        const escaped = src.replace(/"/g, "&quot;");
        return `<div class="wp-iframe" data-src="${escaped}"></div>`;
      }
      return m;
    } catch {
      return m;
    }
  });
}

/**
 * Extract attachment alt text from a subset of WXR-like items for later hydration.
 * Pass in an array of { id: string, meta: Record<string,string> } where meta['_wp_attachment_image_alt'] may exist.
 */
export function buildAttachmentAltMap(items: Array<{ id: string; meta?: Record<string, string> }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const it of items || []) {
    const alt = it?.meta?.["_wp_attachment_image_alt"];
    if (it?.id && alt) map[it.id] = alt;
  }
  return map;
}

/**
 * Hydrate gallery placeholders into concrete <figure><img/></figure> markup using your asset DB.
 * Provide an id->asset map where asset has at least url and optional alt/width/height/srcset.
 */
export function hydrateGalleries(html: string, assetsById: Record<string, { url: string; alt?: string; width?: number; height?: number; srcset?: string }>): string {
  if (!html) return html;
  return html.replace(/<div class="wp-gallery-placeholder"([^>]*)><\/div>/gi, (m, attrs) => {
    const idsMatch = attrs.match(/data-wp-gallery-ids="([^"]+)"/i);
    const colsMatch = attrs.match(/data-wp-gallery-columns="(\d+)"/i);
    const ids = idsMatch ? idsMatch[1].split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    const columns = colsMatch ? parseInt(colsMatch[1], 10) : undefined;
    const figures: string[] = [];
    for (const id of ids) {
      const asset = assetsById[id];
      if (!asset?.url) continue;
      const alt = (asset.alt || "").replace(/"/g, "&quot;");
      const w = asset.width ? ` width="${asset.width}"` : "";
      const h = asset.height ? ` height="${asset.height}"` : "";
      const ss = asset.srcset ? ` srcset="${asset.srcset.replace(/"/g, "&quot;")}"` : "";
      figures.push(`<figure class="wp-gallery-item"><img src="${asset.url.replace(/"/g, "&quot;")}" alt="${alt}"${w}${h}${ss} /></figure>`);
    }
    const style = columns ? ` style="--wp-gallery-columns:${columns}"` : "";
    return `<div class="wp-gallery"${style}>${figures.join("")}</div>`;
  });
}
