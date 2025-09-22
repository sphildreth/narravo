// SPDX-License-Identifier: Apache-2.0

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { tags, categories, postTags, commentTags } from "@/drizzle/schema";
import type { TagDTO, CategoryDTO } from "@/src/types/content";
import slugify from "slugify";

/**
 * Create or get existing tag by name
 */
export async function upsertTag(name: string): Promise<TagDTO> {
  const slug = slugify(name.toLowerCase(), { strict: true });
  
  // Try to find existing tag first
  const existing = await db
    .select()
    .from(tags)
    .where(sql`lower(name) = ${name.toLowerCase()}`)
    .limit(1);
    
  if (existing.length > 0) {
    const tag = existing[0]!;
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
  
  // Create new tag
  const result = await db.insert(tags).values({
    name: name.trim(),
    slug,
  }).returning();
  
  const tag = result[0]!;
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    createdAt: tag.createdAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Create or get existing category by name
 */
export async function upsertCategory(name: string): Promise<CategoryDTO> {
  const slug = slugify(name.toLowerCase(), { strict: true });
  
  // Try to find existing category first
  const existing = await db
    .select()
    .from(categories)
    .where(sql`lower(name) = ${name.toLowerCase()}`)
    .limit(1);
    
  if (existing.length > 0) {
    const category = existing[0]!;
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      createdAt: category.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
  
  // Create new category
  const result = await db.insert(categories).values({
    name: name.trim(),
    slug,
  }).returning();
  
  const category = result[0]!;
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    createdAt: category.createdAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get all tags for a post
 */
export async function getPostTags(postId: string): Promise<TagDTO[]> {
  const result: any = await db.execute(sql`
    select t.id, t.name, t.slug, t.created_at as "createdAt"
    from tags t
    inner join post_tags pt on pt.tag_id = t.id
    where pt.post_id = ${postId}
    order by t.name
  `);
  
  return (result.rows || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

/**
 * Get category for a post
 */
export async function getPostCategory(categoryId: string): Promise<CategoryDTO | null> {
  const result = await db
    .select()
    .from(categories)
    .where(sql`id = ${categoryId}`)
    .limit(1);
    
  if (result.length === 0) return null;
  
  const category = result[0]!;
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    createdAt: category.createdAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Add tags to a post
 */
export async function addTagsToPost(postId: string, tagNames: string[]): Promise<void> {
  for (const tagName of tagNames) {
    const tag = await upsertTag(tagName);
    
    // Check if relationship already exists
    const existing = await db
      .select()
      .from(postTags)
      .where(sql`post_id = ${postId} and tag_id = ${tag.id}`)
      .limit(1);
      
    if (existing.length === 0) {
      await db.insert(postTags).values({
        postId,
        tagId: tag.id,
      });
    }
  }
}

/**
 * Get posts by tag slug with pagination
 */
export async function getPostsByTag(
  tagSlug: string, 
  options: { cursor?: { publishedAt: string; id: string } | null; limit?: number } = {}
): Promise<{ items: any[]; nextCursor: { publishedAt: string; id: string } | null }> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const c = options.cursor;

  const result: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.published_at as "publishedAt", p.views_total as "viewsTotal"
    from posts p
    inner join post_tags pt on pt.post_id = p.id
    inner join tags t on t.id = pt.tag_id
    where t.slug = ${tagSlug}
      and p.published_at is not null
      ${c ? sql`and (p.published_at, p.id) < (${c.publishedAt}::timestamptz, ${c.id}::uuid)` : sql``}
    order by p.published_at desc nulls last, p.id desc
    limit ${limit + 1}
  `);

  const rows: any[] = result.rows ?? [];
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit).map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? null,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    viewsTotal: r.viewsTotal ?? 0,
  }));
  
  const last = slice.at(-1);
  const nextCursor = hasMore && last && last.publishedAt ? { publishedAt: last.publishedAt, id: last.id } : null;
  
  return { items: slice, nextCursor };
}

/**
 * Get posts by category slug with pagination
 */
export async function getPostsByCategory(
  categorySlug: string,
  options: { cursor?: { publishedAt: string; id: string } | null; limit?: number } = {}
): Promise<{ items: any[]; nextCursor: { publishedAt: string; id: string } | null }> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const c = options.cursor;

  const result: any = await db.execute(sql`
    select p.id, p.slug, p.title, p.excerpt, p.published_at as "publishedAt", p.views_total as "viewsTotal"
    from posts p
    inner join categories c on c.id = p.category_id
    where c.slug = ${categorySlug}
      and p.published_at is not null
      ${c ? sql`and (p.published_at, p.id) < (${c.publishedAt}::timestamptz, ${c.id}::uuid)` : sql``}
    order by p.published_at desc nulls last, p.id desc
    limit ${limit + 1}
  `);

  const rows: any[] = result.rows ?? [];
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit).map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? null,
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    viewsTotal: r.viewsTotal ?? 0,
  }));
  
  const last = slice.at(-1);
  const nextCursor = hasMore && last && last.publishedAt ? { publishedAt: last.publishedAt, id: last.id } : null;
  
  return { items: slice, nextCursor };
}

/**
 * Get tag by slug
 */
export async function getTagBySlug(slug: string): Promise<TagDTO | null> {
  const result = await db
    .select()
    .from(tags)
    .where(sql`slug = ${slug}`)
    .limit(1);
    
  if (result.length === 0) return null;
  
  const tag = result[0]!;
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    createdAt: tag.createdAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
  const result = await db
    .select()
    .from(categories)
    .where(sql`slug = ${slug}`)
    .limit(1);
    
  if (result.length === 0) return null;
  
  const category = result[0]!;
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    createdAt: category.createdAt?.toISOString() || new Date().toISOString(),
  };
}