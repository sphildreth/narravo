// SPDX-License-Identifier: Apache-2.0
import { revalidateTag } from "next/cache";
import { getArchiveCacheTag } from "./archives";

/**
 * Revalidate cache tags for a post and its archive pages
 */
export function revalidatePostAndArchives(postId: string, publishedAt?: Date | string | null) {
  // Always revalidate the specific post
  revalidateTag(`post:${postId}`);
  
  // Revalidate home page (shows latest posts)
  revalidateTag("home");
  
  // If post has a published date, revalidate relevant archive pages
  if (publishedAt) {
    const date = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      // Revalidate year and month archive pages
      revalidateTag(getArchiveCacheTag(year));
      revalidateTag(getArchiveCacheTag(year, month));
    }
  }
}

/**
 * Revalidate all archive-related tags (useful for bulk operations)
 */
export function revalidateAllArchives() {
  revalidateTag("home");
  
  // Note: We can't revalidate all archive tags without knowing which ones exist
  // This would be enhanced in a production system with a registry of active tags
}

/**
 * Revalidate cache tags when appearance settings change
 */
export function revalidateAppearance() {
  revalidateTag("home");
  // Banner appears on home page, so revalidate it when banner settings change
}