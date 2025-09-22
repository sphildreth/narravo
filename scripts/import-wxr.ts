// SPDX-License-Identifier: Apache-2.0
import { parseStringPromise } from "xml2js";
import { db } from "../lib/db";
import { posts, redirects } from "../drizzle/schema";
import { sanitizeHtml } from "../lib/sanitize";
import { getS3Config, S3Service } from "../lib/s3";
import slugify from "slugify";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";

export interface WxrItem {
  title?: string;
  guid?: string;
  link?: string;
  "content:encoded"?: string;
  "excerpt:encoded"?: string;
  "wp:post_date"?: string;
  "wp:post_date_gmt"?: string;
  "wp:post_name"?: string;
  "wp:status"?: string;
  "wp:post_type"?: string;
  "wp:post_parent"?: string;
  "wp:attachment_url"?: string;
}

export interface ParsedPost {
  guid: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string | null;
  publishedAt: Date | null;
  originalUrl?: string;
  status: string;
  postType: string;
}

export interface ParsedAttachment {
  guid: string;
  title: string;
  attachmentUrl: string;
  type: "attachment";
}

export interface ImportOptions {
  dryRun?: boolean;
  skipMedia?: boolean;
  verbose?: boolean;
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
  const status = item["wp:status"];
  const guid = item.guid;

  if (!guid) return null;

  // Handle attachments
  if (postType === "attachment") {
    const attachmentUrl = item["wp:attachment_url"];
    if (!attachmentUrl) return null;

    return {
      guid,
      title: item.title || "Untitled Attachment",
      attachmentUrl,
      type: "attachment",
    };
  }

  // Only import published posts
  if (postType !== "post" || status !== "publish") {
    return null;
  }

  const title = item.title || "Untitled";
  const originalSlug = item["wp:post_name"] || "";
  const slug = originalSlug ? slugify(originalSlug, { lower: true, strict: true }) : 
               slugify(title, { lower: true, strict: true }) || `post-${Date.now()}`;

  const rawHtml = item["content:encoded"] || "";
  const html = sanitizeHtml(rawHtml);
  
  const excerpt = item["excerpt:encoded"] || null;
  
  // Parse date
  let publishedAt: Date | null = null;
  const dateStr = item["wp:post_date_gmt"] || item["wp:post_date"];
  if (dateStr) {
    // Handle WordPress date format (YYYY-MM-DD HH:MM:SS)
    const isoDate = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z";
    const parsed = new Date(isoDate);
    if (!isNaN(parsed.getTime())) {
      publishedAt = parsed;
    }
  }

  const returnObj: ParsedPost = {
    guid,
    title,
    slug,
    html,
    excerpt,
    publishedAt,
    status: status || "publish",
    postType: postType || "post",
  };

  if (item.link) {
    returnObj.originalUrl = item.link;
  }

  return returnObj;
}

async function downloadMedia(url: string, s3Service: S3Service | null): Promise<string | null> {
  if (!s3Service) {
    console.log(`S3 not configured, skipping media download: ${url}`);
    return null;
  }

  try {
    // Download the file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Generate SHA256 hash for deduplication
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Extract file extension
    const urlParts = new URL(url);
    const pathParts = urlParts.pathname.split('/');
    const filename = pathParts[pathParts.length - 1] || 'unknown';
    const ext = filename.split('.').pop() || 'bin';

    // Create presigned upload
    const uploadData = await s3Service.createPresignedPost(
      `${hash}.${ext}`,
      contentType,
      {
        maxBytes: buffer.byteLength,
        keyPrefix: 'imported-media',
      }
    );

    // Upload to S3
    const formData = new FormData();
    Object.entries(uploadData.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', new Blob([buffer], { type: contentType }));

    const uploadResponse = await fetch(uploadData.url, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    return s3Service.getPublicUrl(uploadData.key);
  } catch (error) {
    console.error(`Failed to download/upload media ${url}:`, error);
    return null;
  }
}

function rewriteMediaUrls(html: string, mediaUrlMap: Map<string, string>): string {
  let rewritten = html;
  
  for (const [oldUrl, newUrl] of mediaUrlMap) {
    // Replace both src and href attributes
    rewritten = rewritten.replace(
      new RegExp(escapeRegExp(oldUrl), 'g'),
      newUrl
    );
  }
  
  return rewritten;
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

export async function importWxr(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
  const { dryRun = false, skipMedia = false, verbose = false } = options;
  
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
  if (!skipMedia) {
    const s3Config = getS3Config();
    if (s3Config) {
      s3Service = new S3Service(s3Config);
    }
  }

  try {
    // Parse XML
    const xml = await fs.readFile(filePath, "utf-8");
    const doc = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
    const items = doc.rss?.channel?.item ?? [];
    const itemArray = Array.isArray(items) ? items : [items];

    result.summary.totalItems = itemArray.length;

    // Parse all items first
    const parsedItems: Array<ParsedPost | ParsedAttachment> = [];
    const existingSlugs = new Set<string>();

    // Get existing slugs to avoid conflicts
    if (!dryRun) {
      const existingPosts = await db.execute(sql`SELECT slug FROM posts`);
      (existingPosts.rows || []).forEach((row: any) => {
        existingSlugs.add(row.slug);
      });
    }

    for (const item of itemArray) {
      const parsed = parseWxrItem(item);
      if (parsed) {
        if ('slug' in parsed) {
          // Ensure unique slug
          parsed.slug = generateSlugWithFallback(parsed.slug, existingSlugs);
          existingSlugs.add(parsed.slug);
        }
        parsedItems.push(parsed);
      } else {
        result.summary.skipped++;
      }
    }

    // Process attachments first to build media URL mapping
    const attachments = parsedItems.filter((item): item is ParsedAttachment => 
      'type' in item && item.type === 'attachment'
    );

    for (const attachment of attachments) {
      try {
        if (!skipMedia && s3Service) {
          const newUrl = await downloadMedia(attachment.attachmentUrl, s3Service);
          if (newUrl) {
            result.mediaUrls.set(attachment.attachmentUrl, newUrl);
            if (verbose) {
              console.log(`Downloaded: ${attachment.attachmentUrl} -> ${newUrl}`);
            }
          }
        }
        result.summary.attachmentsProcessed++;
      } catch (error) {
        result.errors.push({
          item: attachment.title,
          error: `Failed to process attachment: ${error}`,
        });
      }
    }

    // Process posts
    const postItems = parsedItems.filter((item): item is ParsedPost => 
      'slug' in item
    );

    for (const post of postItems) {
      try {
        // Rewrite media URLs in content
        const finalHtml = rewriteMediaUrls(post.html, result.mediaUrls);

        if (!dryRun) {
          // Insert or update post using GUID for idempotency
          await db.insert(posts).values({
            slug: post.slug,
            title: post.title,
            // Store sanitized HTML in both legacy html and new bodyHtml
            html: finalHtml,
            bodyHtml: finalHtml,
            // No markdown available from WXR exports
            bodyMd: null,
            excerpt: post.excerpt,
            guid: post.guid,
            publishedAt: post.publishedAt,
          }).onConflictDoUpdate({
            target: posts.guid,
            set: {
              title: post.title,
              // Keep legacy html in sync
              html: finalHtml,
              // Update rendered HTML; do not overwrite bodyMd to preserve later edits
              bodyHtml: finalHtml,
              excerpt: post.excerpt,
              publishedAt: post.publishedAt,
              updatedAt: sql`now()`,
            },
          });

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
        }

        result.summary.postsImported++;

        if (verbose) {
          console.log(`Imported: ${post.title} -> /${post.slug}`);
        }

      } catch (error) {
        result.errors.push({
          item: post.title,
          error: `Failed to import post: ${error}`,
        });
      }
    }

  } catch (error) {
    result.errors.push({
      item: "global",
      error: `Failed to parse WXR file: ${error}`,
    });
  }

  return result;
}

async function run() {
  const args = process.argv.slice(2);
  const pathArg = args.find(a => a.startsWith("path="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");
  const skipMedia = args.includes("--skip-media");
  const verbose = args.includes("--verbose");

  if (!pathArg) {
    console.error("Usage: pnpm wxr:import path=./export.xml [--dry-run] [--skip-media] [--verbose]");
    process.exit(1);
  }

  console.log(`Starting WXR import from: ${pathArg}`);
  if (dryRun) console.log("🏃 DRY RUN MODE - No changes will be made");
  if (skipMedia) console.log("📷 SKIP MEDIA MODE - Media will not be downloaded");

  const startTime = Date.now();
  const result = await importWxr(pathArg, { dryRun, skipMedia, verbose });
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
  await fs.writeFile(checkpointPath, JSON.stringify(checkpointData, null, 2));
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
