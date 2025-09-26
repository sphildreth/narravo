// SPDX-License-Identifier: Apache-2.0

"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidateTag, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const deletePostSchema = z.object({
  id: z.string().uuid("Invalid post ID"),
});

/**
 * Delete a post - admin only action for use on public post pages
 */
export async function deletePostAction(formData: FormData) {
  try {
    // Verify admin permissions
    await requireAdmin();
    
    // Validate input
    const data = {
      id: formData.get("id") as string,
    };
    
    const parsed = deletePostSchema.safeParse(data);
    if (!parsed.success) {
      return { 
        error: parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ") 
      };
    }
    
    const { id } = parsed.data;
    
    // Get post info before deletion for revalidation
    const [post] = await db
      .select({ slug: posts.slug, title: posts.title })
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);
      
    if (!post) {
      return { error: "Post not found" };
    }
    
    // Delete post (comments and relations cascade via foreign key)
    await db.delete(posts).where(eq(posts.id, id));
    
    // Revalidate caches
    revalidateTag("home"); // Home page cache
    revalidateTag(`post:${id}`); // Post-specific cache
    revalidatePath("/admin/posts"); // Admin posts list
    revalidatePath(`/${post.slug}`); // Post detail page
    
    return { 
      success: true, 
      message: `Post "${post.title}" deleted successfully` 
    };
  } catch (error) {
    console.error("Error deleting post:", error);
    
    // Handle specific admin authorization error
    if (error instanceof Error && error.message === "Forbidden") {
      return { error: "You don't have permission to delete posts" };
    }
    
    return { error: "Failed to delete post" };
  }
}

/**
 * Validate if current user can delete posts (admin check)
 */
export async function canDeletePosts(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}