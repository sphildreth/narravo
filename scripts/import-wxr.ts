// SPDX-License-Identifier: Apache-2.0
import { parseStringPromise } from "xml2js";
import { db } from "@/lib/db";
import { posts, redirects, categories, tags, postTags, comments, users, importJobs, importJobErrors } from "@/drizzle/schema";
import { sanitizeHtml } from "@/lib/sanitize";
import { getS3Config, S3Service } from "@/lib/s3";
import slugify from "slugify";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { sql, eq, and } from "drizzle-orm";

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
  const status = item["wp:status"];
  
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

async function downloadMedia(url: string, s3Service: S3Service | null, allowedHosts: string[]): Promise<string | null> {
  if (!s3Service) {
    return null; // No S3 configured, skip download
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

    const buffer = await response.arrayBuffer();
    const hash = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
    
    // Use hash as key to avoid duplicates
    const extension = url.split('.').pop()?.toLowerCase() || 'bin';
    const key = `imported-media/${hash}.${extension}`;
    
    // Check if already exists
    try {
      const existingUrl = s3Service.getPublicUrl(key);
      // TODO: Check if file actually exists in S3
      return existingUrl;
    } catch {
      // File doesn't exist, upload it
    }

    // Upload to S3
    const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
    const putCommand = new PutObjectCommand({
      Bucket: s3Service['bucket'], // Access private property
      Key: key,
      Body: new Uint8Array(buffer), // Convert ArrayBuffer to Uint8Array
      ContentType: response.headers.get('content-type') || 'application/octet-stream',
    });

    await s3Service['client'].send(putCommand); // Access private client
    return s3Service.getPublicUrl(key);
  } catch (error) {
    console.error(`Failed to download media ${url}:`, error);
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
  if (!skipMedia) {
    const s3Config = getS3Config();
    if (s3Config) {
      s3Service = new S3Service(s3Config);
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
    const xml = await fs.readFile(filePath, "utf-8");
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
          const newUrl = await downloadMedia(attachment.attachmentUrl, s3Service, allowedHosts);
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
        // Rewrite media URLs in content
        const finalHtml = rewriteMediaUrls(sanitizeHtml(post.html), result.mediaUrls);

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
        let featuredImageAlt: string | undefined;
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

  if (!pathArg) {
    console.error("Usage: npx tsx scripts/import-wxr.ts path=./export.xml [--dry-run] [--skip-media] [--verbose]");
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