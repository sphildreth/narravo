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
    const attachmentMap = new Map<string, string>(); // attachment ID -> URL

    // Get existing slugs to avoid conflicts
    if (!dryRun) {
      const existingPosts = await db.execute(sql`SELECT slug FROM posts`);
      (existingPosts.rows || []).forEach((row: any) => {
        existingSlugs.add(row.slug);
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
        
        // Build attachment map for featured images
        if (parsed.type === "attachment") {
          const postId = item["wp:post_id"];
          if (postId) {
            attachmentMap.set(postId, parsed.attachmentUrl);
          }
        }
        
        parsedItems.push(parsed);
      } else {
        result.summary.skipped++;
      }
    }

    // Process attachments first (for media downloads)
    const attachmentItems = parsedItems.filter((item): item is ParsedAttachment => 
      item.type === "attachment"
    );

    if (verbose && attachmentItems.length > 0) {
      console.log(`📷 Processing ${attachmentItems.length} attachments...`);
    }

    for (const attachment of attachmentItems) {
      try {
        if (!skipMedia && attachment.attachmentUrl) {
          const newUrl = await downloadMedia(attachment.attachmentUrl, s3Service, localService, allowedHosts, { dryRun, verbose });
          if (newUrl) {
            result.mediaUrls.set(attachment.attachmentUrl, newUrl);
          }
        }
        result.summary.attachmentsProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({
          item: attachment.guid,
          error: `Attachment processing failed: ${errorMsg}`
        });
        
        if (jobId && !dryRun) {
          await db.insert(importJobErrors).values({
            jobId,
            itemIdentifier: attachment.guid,
            errorType: "media_download",
            errorMessage: errorMsg,
            itemData: { url: attachment.attachmentUrl }
          });
        }
      }
    }

    // Process posts
    const postItems = parsedItems.filter((item): item is ParsedPost => 
      item.type === "post"
    );

    if (verbose && postItems.length > 0) {
      console.log(`📄 Processing ${postItems.length} posts...`);
    }

    for (const post of postItems) {
      try {
        // Proactively download any remote media found in the HTML content
        if (!skipMedia && (s3Service || localService)) {
          const mediaUrls = extractMediaUrlsFromHtml(post.html);
          for (const mediaUrl of mediaUrls) {
            if (!result.mediaUrls.has(mediaUrl)) {
              const newUrl = await downloadMedia(mediaUrl, s3Service, localService, allowedHosts, { dryRun, verbose });
              if (newUrl) {
                result.mediaUrls.set(mediaUrl, newUrl);
              }
            }
          }
        }

        // Rewrite media URLs in content
        const expanded = expandShortcodes(post.html);
        const normalized = normalizeWpLists(expanded);
        const sanitized = sanitizeHtml(normalized);
        const finalHtml = rewriteMediaUrls(sanitized, result.mediaUrls);

        // Get or create author
        let authorId: string | null = null;
        if (!dryRun) {
          const author = await db.insert(users).values({
            login: post.author,
            name: post.author,
            email: `${post.author}@imported.local`, // Placeholder email
          }).onConflictDoUpdate({
            target: users.login,
            set: {
              name: post.author,
            },
          }).returning();
          if (author[0]) {
            authorId = author[0].id;
          }
        }

        // Process categories and tags
        let primaryCategoryId: string | null = null;
        const tagIds: string[] = [];

        if (!dryRun) {
          // Create categories
          for (const category of post.categories) {
            const cat = await db.insert(categories).values({
              name: category.name,
              slug: category.slug,
            }).onConflictDoUpdate({
              target: categories.slug,
              set: { name: category.name },
            }).returning();

            if (!primaryCategoryId && cat[0]) {
              primaryCategoryId = cat[0].id; // First category is primary
            }
          }

          // Create tags
          for (const tag of post.tags) {
            const tagRecord = await db.insert(tags).values({
              name: tag.name,
              slug: tag.slug,
            }).onConflictDoUpdate({
              target: tags.slug,
              set: { name: tag.name },
            }).returning();

            if (tagRecord[0]) {
              tagIds.push(tagRecord[0].id);
            }
          }
        }

        // Handle featured image
        let featuredImageUrl: string | undefined;
        let featuredImageAlt: string | undefined = undefined;
        if (post.featuredImageId && attachmentMap.has(post.featuredImageId)) {
          const originalUrl = attachmentMap.get(post.featuredImageId)!;
          featuredImageUrl = result.mediaUrls.get(originalUrl) || originalUrl;
          // Alt text would need to be extracted from attachment parsing - simplified for now
        }

        if (!dryRun) {
          // Insert or update post using GUID for idempotency
          const insertedPost = await db.insert(posts).values({
            slug: post.slug,
            title: post.title,
            // Store sanitized HTML in both legacy html and new bodyHtml
            html: finalHtml,
            bodyHtml: finalHtml,
            // No markdown available from WXR exports
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
              // Keep legacy html in sync
              html: finalHtml,
              // Update rendered HTML; do not overwrite bodyMd to preserve later edits
              bodyHtml: finalHtml,
              excerpt: post.excerpt || null,
              publishedAt: post.publishedAt || null,
              categoryId: primaryCategoryId,
              featuredImageUrl,
              featuredImageAlt,
              updatedAt: sql`now()`,
            },
          }).returning();

          // Create post-tag relationships
          if (tagIds.length > 0 && insertedPost[0]) {
            // Delete existing tags for this post
            await db.delete(postTags).where(eq(postTags.postId, insertedPost[0].id));

            // Insert new tags
            for (const tagId of tagIds) {
              await db.insert(postTags).values({
                postId: insertedPost[0].id,
                tagId,
              }).onConflictDoNothing();
            }
          }

          // Create redirect if we have an original URL
          if (post.originalUrl) {
            try {
              const url = new URL(post.originalUrl);
              const fromPath = url.pathname;
              const toPath = `/posts/${post.slug}`;

              if (fromPath !== toPath) {
                await db.insert(redirects).values({
                  fromPath,
                  toPath,
                  status: 301,
                }).onConflictDoUpdate({
                  target: redirects.fromPath,
                  set: {
                    toPath,
                    status: 301,
                  },
                });
                result.summary.redirectsCreated++;
              }
            } catch (urlError) {
              // Invalid URL, skip redirect
            }
          }

          // Process comments
          if (post.comments.length > 0 && insertedPost[0]) {
            const commentMap = new Map<string, string>(); // original ID -> new ID

            // Sort comments by parent hierarchy (parents first)
            const sortedComments = [...post.comments].sort((a, b) => {
              if (!a.parentId && b.parentId) return -1;
              if (a.parentId && !b.parentId) return 1;
              return 0;
            });

            for (const comment of sortedComments) {
              if (!comment.approved) continue; // Only import approved comments

              // Get or create comment author
              let commentAuthorId: string | null = null;
              if (comment.authorEmail) {
                const commentAuthor = await db.insert(users).values({
                  email: comment.authorEmail,
                  name: comment.author,
                }).onConflictDoUpdate({
                  target: users.email,
                  set: { name: comment.author },
                }).returning();
                if (commentAuthor[0]) {
                  commentAuthorId = commentAuthor[0].id;
                }
              }

              // Determine parent and path
              let parentId: string | null = null;
              let path = "";
              let depth = 0;

              if (comment.parentId && commentMap.has(comment.parentId)) {
                parentId = commentMap.get(comment.parentId)!;
                // Get parent path
                const parent = await db.select({ path: comments.path, depth: comments.depth })
                  .from(comments)
                  .where(eq(comments.id, parentId));
                if (parent[0]) {
                  depth = parent[0].depth + 1;
                  path = parent[0].path;
                }
              }

              // Insert comment
              const insertedComment = await db.insert(comments).values({
                postId: insertedPost[0].id,
                userId: commentAuthorId,
                parentId,
                path: path + (path ? "." : "") + comment.id, // Use original comment ID in path
                depth,
                bodyHtml: sanitizeHtml(comment.content),
                bodyMd: null,
                status: "approved",
                createdAt: comment.date || null,
              }).returning();

              if (insertedComment[0]) {
                commentMap.set(comment.id, insertedComment[0].id);
              }
            }
          }
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
  const allowedHosts = allowedHostsArg
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  if (!pathArg) {
    console.error("Usage: npx tsx scripts/import-wxr.ts path=./export.xml [--dry-run] [--skip-media] [--verbose] [allowedHosts=example.com,cdn.example.com]");
    process.exit(1);
  }

  console.log(`Starting WXR import from: ${pathArg}`);
  if (dryRun) console.log("🏃 DRY RUN MODE - No changes will be made");
  if (skipMedia) console.log("📷 SKIP MEDIA MODE - Media will not be downloaded");
  if (allowedHosts.length > 0) console.log(`🔒 Allowed media hosts: ${allowedHosts.join(", ")}`);

  const startTime = Date.now();
  const result = await importWxr(pathArg, { dryRun, skipMedia, verbose, allowedHosts });
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
    return `<div class="wp-audio"${meta + " " + meta}></div>`;
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
    return `<div class="wp-video"${meta + " " + meta}></div>`;
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
    return `<div class="wp-playlist"${meta + " " + meta}></div>`;
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
    // find existing href
    const hrefMatch = m.match(/href="([^"]+)"/i);
    const href = hrefMatch ? hrefMatch[1] : "";
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
