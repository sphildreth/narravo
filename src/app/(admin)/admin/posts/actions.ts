"use server";
// SPDX-License-Identifier: Apache-2.0

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts } from "@/drizzle/schema";
import { eq, like, desc, asc, sql, and, isNull, isNotNull, or } from "drizzle-orm";
import { revalidateTag, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import slugify from "slugify";
import { sanitizeHtml } from "@/lib/sanitize";
import { markdownToHtmlSync } from "@/lib/markdown";
import { z } from "zod";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// Types for post management
export interface PostsFilter {
  search?: string;
  status?: "published" | "draft";
  dateFrom?: string;
  dateTo?: string;
  hasComments?: boolean;
}

export interface PostsSortOptions {
  field: "updatedAt" | "publishedAt" | "title";
  direction: "asc" | "desc";
}

// Input validation schemas
// Accept either a fully-qualified URL, a relative /uploads/ path (deferred upload becomes a path at commit),
// or an empty string (meaning no featured image).
const featuredImageField = z
  .string()
  .trim()
  .refine(v => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/uploads/"), {
    message: "Must be an absolute URL or a /uploads/ path",
  })
  .optional();

const createPostBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: z.string().min(1, "Slug is required").max(255).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  excerpt: z.string().max(300).optional(),
  html: z.string().optional(),
  bodyMd: z.string().optional(),
  publishedAt: z.string().optional().nullable(),
  featuredImageUrl: featuredImageField,
  featuredImageAlt: z.string().max(255).optional(),
});

const createPostSchema = createPostBaseSchema.refine((data) => !!(data.bodyMd?.trim() || data.html?.trim()), {
  message: "Content is required",
  path: ["content"],
});

const updatePostSchema = createPostBaseSchema.extend({
  id: z.string().uuid(),
  updatedAt: z.string(), // for optimistic concurrency
});

const bulkActionSchema = z.object({
  action: z.enum(["publish", "unpublish", "delete"]),
  ids: z.array(z.string().uuid()).min(1),
});

// Helper function to generate unique slug
async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(title, { lower: true, strict: true });
  
  // Check if slug is available
  const where = excludeId 
    ? and(eq(posts.slug, baseSlug), sql`id != ${excludeId}`)
    : eq(posts.slug, baseSlug);
    
  const existing = await db.select({ id: posts.id }).from(posts).where(where).limit(1);
  
  if (existing.length === 0) {
    return baseSlug;
  }
  
  // Generate numbered variants
  let counter = 1;
  while (counter < 100) {
    const numberedSlug = `${baseSlug}-${counter}`;
    const numberedWhere = excludeId 
      ? and(eq(posts.slug, numberedSlug), sql`id != ${excludeId}`)
      : eq(posts.slug, numberedSlug);
      
    const numberedExisting = await db.select({ id: posts.id }).from(posts).where(numberedWhere).limit(1);
    
    if (numberedExisting.length === 0) {
      return numberedSlug;
    }
    counter++;
  }
  
  throw new Error("Unable to generate unique slug");
}

// Get paginated posts with filtering and sorting
export async function getPostsWithFilters(
  filter: PostsFilter = {},
  sort: PostsSortOptions = { field: "updatedAt", direction: "desc" },
  page: number = 1,
  pageSize: number = 20
) {
  await requireAdmin();
  
  const offset = (page - 1) * pageSize;
  
  // Build where conditions
  const conditions = [];
  
  if (filter.search) {
    conditions.push(
      or(
        like(posts.title, `%${filter.search}%`),
        like(posts.slug, `%${filter.search}%`)
      )
    );
  }
  
  if (filter.status === "published") {
    conditions.push(isNotNull(posts.publishedAt));
  } else if (filter.status === "draft") {
    conditions.push(isNull(posts.publishedAt));
  }
  
  if (filter.dateFrom) {
    conditions.push(sql`${posts.createdAt} >= ${filter.dateFrom}::timestamptz`);
  }
  
  if (filter.dateTo) {
    conditions.push(sql`${posts.createdAt} <= ${filter.dateTo}::timestamptz`);
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Build order by
  let orderBy;
  const direction = sort.direction === "asc" ? asc : desc;
  switch (sort.field) {
    case "title":
      orderBy = direction(posts.title);
      break;
    case "publishedAt":
      orderBy = direction(posts.publishedAt);
      break;
    default:
      orderBy = direction(posts.updatedAt);
  }
  
  // Get posts with comment counts
  const query = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      // Note: comment counts would require a join - keeping simple for now
      // Can be added later with proper join or separate query
    })
    .from(posts)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize + 1) // Get one extra to check if there are more pages
    .offset(offset);
  
  const rows = await query;
  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  
  // Get total count for pagination info
  const totalQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(whereClause);
  
  const [totalResult] = await totalQuery;
  const total = totalResult?.count ?? 0;
  
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      hasMore,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// Get single post for editing
export async function getPostForEdit(id: string) {
  await requireAdmin();
  
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  
  return post || null;
}

// Create new post
export async function createPost(formData: FormData) {
  await requireAdmin();
  
  // If a file is present we defer storing until after validation of other fields.
  const featuredImageFile = formData.get("featuredImageFile") as File | null;

  const data = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    excerpt: formData.get("excerpt") as string || undefined,
    html: (formData.get("html") as string) || undefined,
    bodyMd: (formData.get("bodyMd") as string) || undefined,
    publishedAt: formData.get("publishedAt") as string || null,
    // When a file is chosen the text field is hidden; we pass empty string then derive path.
    featuredImageUrl: (formData.get("featuredImageUrl") as string) || undefined,
    featuredImageAlt: (formData.get("featuredImageAlt") as string) || undefined,
  };
  
  // Validate input
  const parsed = createPostSchema.safeParse(data);
  if (!parsed.success) {
    return { 
      error: parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ") 
    };
  }
  
  const { title, slug, excerpt, html, bodyMd, publishedAt, featuredImageUrl, featuredImageAlt } = parsed.data;
  
  try {
    // Generate slug if not provided or ensure uniqueness
    const finalSlug = slug || await generateUniqueSlug(title);
    
    // Check slug uniqueness if provided
    if (slug) {
      const existing = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
      if (existing.length > 0) {
        return { error: "Slug is already taken" };
      }
    }
    
    // Compute final HTML and markdown
    const fromMd = bodyMd && bodyMd.trim().length > 0;
    const renderedHtml = fromMd ? markdownToHtmlSync(bodyMd!) : sanitizeHtml(html || "");

    // Handle deferred image file (only for new posts so we can name with post id after insert?)
    // Strategy: store file first with temp UUID name, then reference its path. If db insert fails we could leave an orphan,
    // but this is extremely rare; optional future cleanup can reap unreferenced files. (Acceptable tradeoff for now.)
    let finalFeaturedUrl: string | null = null;

    if (featuredImageFile && featuredImageFile instanceof File && featuredImageFile.size > 0) {
      // Basic validation
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]; // extend as needed
      if (!allowed.includes(featuredImageFile.type)) {
        return { error: "Unsupported featured image type" };
      }
      if (featuredImageFile.size > 5 * 1024 * 1024) { // 5MB limit
        return { error: "Featured image file too large (max 5MB)" };
      }
      const arrayBuffer = await featuredImageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = featuredImageFile.name.includes('.') ? '.' + featuredImageFile.name.split('.').pop()!.toLowerCase() : (
        featuredImageFile.type === 'image/png' ? '.png' : featuredImageFile.type === 'image/webp' ? '.webp' : featuredImageFile.type === 'image/gif' ? '.gif' : '.jpg'
      );
      const fileName = `${randomUUID()}${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'featured');
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      finalFeaturedUrl = `/uploads/featured/${fileName}`;
    } else if (featuredImageUrl && featuredImageUrl.trim() !== "") {
      finalFeaturedUrl = featuredImageUrl;
    }

    // Create post
    const [newPost] = await db
      .insert(posts)
      .values({
        title,
        slug: finalSlug,
        excerpt,
        bodyMd: fromMd ? bodyMd! : null,
        bodyHtml: fromMd ? renderedHtml : null,
        html: renderedHtml, // keep legacy column in sync
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        featuredImageUrl: finalFeaturedUrl,
        featuredImageAlt: featuredImageAlt || null,
      })
      .returning();
    
    if (!newPost) {
      throw new Error("Failed to create post");
    }
    
    // Revalidate caches
    await revalidateAfterPostChange(newPost.id);
    
    return { success: true, post: newPost };
  } catch (error) {
    console.error("Error creating post:", error);
    return { error: "Failed to create post" };
  }
}

// Update existing post
export async function updatePost(formData: FormData) {
  await requireAdmin();
  
  const featuredImageFile = formData.get("featuredImageFile") as File | null;

  const data = {
    id: formData.get("id") as string,
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    excerpt: formData.get("excerpt") as string || undefined,
    html: (formData.get("html") as string) || undefined,
    bodyMd: (formData.get("bodyMd") as string) || undefined,
    publishedAt: formData.get("publishedAt") as string || null,
    updatedAt: formData.get("updatedAt") as string,
    featuredImageUrl: (formData.get("featuredImageUrl") as string) || undefined,
    featuredImageAlt: (formData.get("featuredImageAlt") as string) || undefined,
  };
  
  // Validate input
  const parsed = updatePostSchema.safeParse(data);
  if (!parsed.success) {
    return { 
      error: parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ") 
    };
  }
  
  const { id, title, slug, excerpt, html, bodyMd, publishedAt, updatedAt, featuredImageUrl, featuredImageAlt } = parsed.data;
  
  try {
    // Check for concurrent updates
    const [current] = await db
      .select({ updatedAt: posts.updatedAt })
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);
    
    if (!current) {
      return { error: "Post not found" };
    }
    
    if (!current.updatedAt || current.updatedAt.toISOString() !== updatedAt) {
      return { error: "Post has been modified by another user. Please reload and try again." };
    }
    
    // Check slug uniqueness
    const existing = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.slug, slug), sql`id != ${id}`))
      .limit(1);
      
    if (existing.length > 0) {
      return { error: "Slug is already taken" };
    }
    
    // Compute final HTML and markdown
    const fromMd = bodyMd && bodyMd.trim().length > 0;
    const renderedHtml = fromMd ? markdownToHtmlSync(bodyMd!) : sanitizeHtml(html || "");
  
    let finalFeaturedUrl: string | null = null;
    if (featuredImageFile && featuredImageFile instanceof File && featuredImageFile.size > 0) {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]; 
      if (!allowed.includes(featuredImageFile.type)) {
        return { error: "Unsupported featured image type" };
      }
      if (featuredImageFile.size > 5 * 1024 * 1024) {
        return { error: "Featured image file too large (max 5MB)" };
      }
      const arrayBuffer = await featuredImageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = featuredImageFile.name.includes('.') ? '.' + featuredImageFile.name.split('.').pop()!.toLowerCase() : (
        featuredImageFile.type === 'image/png' ? '.png' : featuredImageFile.type === 'image/webp' ? '.webp' : featuredImageFile.type === 'image/gif' ? '.gif' : '.jpg'
      );
      const fileName = `${randomUUID()}${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'featured');
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), buffer);
      finalFeaturedUrl = `/uploads/featured/${fileName}`;
    } else if (featuredImageUrl && featuredImageUrl.trim() !== "") {
      finalFeaturedUrl = featuredImageUrl;
    }

    // Update post
    const [updatedPost] = await db
      .update(posts)
      .set({
        title,
        slug,
        excerpt,
        bodyMd: fromMd ? bodyMd! : null,
        bodyHtml: fromMd ? renderedHtml : null,
        html: renderedHtml,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        updatedAt: new Date(),
        featuredImageUrl: finalFeaturedUrl,
        featuredImageAlt: featuredImageAlt || null,
      })
      .where(eq(posts.id, id))
      .returning();
    
    // Revalidate caches
    await revalidateAfterPostChange(id);
    
    return { success: true, post: updatedPost };
  } catch (error) {
    console.error("Error updating post:", error);
    return { error: "Failed to update post" };
  }
}

// Delete post
export async function deletePost(postId: string) {
  await requireAdmin();
  
  try {
    // Get post info before deletion for revalidation
    const [post] = await db
      .select({ slug: posts.slug })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
      
    if (!post) {
      return { error: "Post not found" };
    }
    
    // Delete post (comments cascade via foreign key)
    await db.delete(posts).where(eq(posts.id, postId));
    
    // Revalidate caches
    await revalidateAfterPostChange(postId, post.slug);
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting post:", error);
    return { error: "Failed to delete post" };
  }
}

// Bulk actions
export async function performBulkAction(formData: FormData) {
  await requireAdmin();
  
  const data = {
    action: formData.get("action") as string,
    ids: formData.getAll("ids") as string[],
  };
  
  const parsed = bulkActionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid bulk action data" };
  }
  
  const { action, ids } = parsed.data;
  
  try {
    let updated = 0;
    
    switch (action) {
      case "publish":
        const publishResults = await db
          .update(posts)
          .set({ publishedAt: new Date(), updatedAt: new Date() })
          .where(sql`id = ANY(${ids}) AND published_at IS NULL`)
          .returning({ id: posts.id });
        updated = publishResults.length;
        break;
        
      case "unpublish":
        const unpublishResults = await db
          .update(posts)
          .set({ publishedAt: null, updatedAt: new Date() })
          .where(sql`id = ANY(${ids}) AND published_at IS NOT NULL`)
          .returning({ id: posts.id });
        updated = unpublishResults.length;
        break;
        
      case "delete":
        const deleteResults = await db
          .delete(posts)
          .where(sql`id = ANY(${ids})`)
          .returning({ id: posts.id });
        updated = deleteResults.length;
        break;
    }
    
    // Revalidate caches for all affected posts
    for (const id of ids) {
      await revalidateAfterPostChange(id);
    }
    
    return { success: true, updated };
  } catch (error) {
    console.error("Error performing bulk action:", error);
    return { error: "Failed to perform bulk action" };
  }
}

// Helper to revalidate caches after post changes
async function revalidateAfterPostChange(postId: string, slug?: string) {
  // Revalidate post-specific cache
  revalidateTag(`post:${postId}`);
  
  // Revalidate home page
  revalidateTag("home");
  
  // Revalidate posts list
  revalidatePath("/admin/posts");
  
  // If we have the slug, revalidate the post page
  if (slug) {
    revalidatePath(`/${slug}`);
  }
  
  // Note: Archive revalidation would need the post date
  // This could be enhanced to get the date and revalidate archive pages
}

// Generate slug from title (utility for frontend)
export async function generateSlugFromTitle(title: string, excludeId?: string) {
  await requireAdmin();
  
  if (!title.trim()) {
    return { error: "Title is required" };
  }
  
  try {
    const slug = await generateUniqueSlug(title, excludeId);
    return { success: true, slug };
  } catch (error) {
    return { error: "Failed to generate slug" };
  }
}

// Check slug availability
export async function checkSlugAvailability(slug: string, excludeId?: string) {
  await requireAdmin();
  
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { available: false, error: "Invalid slug format" };
  }
  
  try {
    const where = excludeId 
      ? and(eq(posts.slug, slug), sql`id != ${excludeId}`)
      : eq(posts.slug, slug);
      
    const existing = await db.select({ id: posts.id }).from(posts).where(where).limit(1);
    
    return { available: existing.length === 0 };
  } catch (error) {
    return { available: false, error: "Failed to check slug availability" };
  }
}

// Toggle post lock status
export async function togglePostLock(postId: string) {
  await requireAdmin();
  
  if (!postId) {
    return { error: "Post ID is required" };
  }
  
  try {
    // Get current lock status
    const [currentPost] = await db
      .select({ isLocked: posts.isLocked, slug: posts.slug })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
      
    if (!currentPost) {
      return { error: "Post not found" };
    }
    
    // Toggle the lock status
    const [updatedPost] = await db
      .update(posts)
      .set({ 
        isLocked: !currentPost.isLocked,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId))
      .returning({ isLocked: posts.isLocked, slug: posts.slug });
    
    // Revalidate caches
    await revalidateAfterPostChange(postId, updatedPost.slug);
    
    return { 
      success: true, 
      isLocked: updatedPost.isLocked,
      message: updatedPost.isLocked ? "Post locked" : "Post unlocked"
    };
  } catch (error) {
    console.error("Error toggling post lock:", error);
    return { error: "Failed to toggle post lock" };
  }
}

// Unpublish a single post
export async function unpublishPost(postId: string) {
  await requireAdmin();
  
  if (!postId) {
    return { error: "Post ID is required" };
  }
  
  try {
    // Check if post is currently published
    const [currentPost] = await db
      .select({ publishedAt: posts.publishedAt, slug: posts.slug })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
      
    if (!currentPost) {
      return { error: "Post not found" };
    }
    
    if (!currentPost.publishedAt) {
      return { error: "Post is already unpublished" };
    }
    
    // Unpublish the post
    const [updatedPost] = await db
      .update(posts)
      .set({ 
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId))
      .returning({ slug: posts.slug });
    
    // Revalidate caches
    await revalidateAfterPostChange(postId, updatedPost.slug);
    
    return { success: true, message: "Post unpublished" };
  } catch (error) {
    console.error("Error unpublishing post:", error);
    return { error: "Failed to unpublish post" };
  }
}