"use server";
// SPDX-License-Identifier: Apache-2.0

import { requireAdmin } from "@/lib/auth";
import { getModerationQueue, revalidateAfterModeration, type ModerationFilter } from "@/lib/moderation";
import { moderateComments, type ModerateInput, type ModerationRepo } from "@/lib/adminModeration";
import { db } from "@/lib/db";
import { comments, commentAttachments, posts } from "@/drizzle/schema";
import { eq, sql, desc, asc } from "drizzle-orm";
import { ConfigServiceImpl } from "@/lib/config";
import { sanitizeHtml } from "@/lib/sanitize";
import { createCommentCore, sanitizeMarkdown } from "@/lib/comments";
import { z } from "zod";

class DrizzleModerationRepo implements ModerationRepo {
  async updateStatus(ids: string[], status: "approved" | "spam" | "deleted"): Promise<number> {
    let count = 0;
    for (const id of ids) {
      await db.update(comments).set({ status }).where(eq(comments.id, id));
      count += 1;
    }
    return count;
  }
  async hardDelete(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      await db.delete(comments).where(eq(comments.id, id));
      count += 1;
    }
    return count;
  }
  async editComment(id: string, bodyMd: string, bodyHtml: string): Promise<boolean> {
    await db.update(comments).set({ bodyMd, bodyHtml }).where(eq(comments.id, id));
    return true;
  }
  async removeAttachment(attachmentId: string): Promise<boolean> {
    await db.delete(commentAttachments).where(eq(commentAttachments.id, attachmentId));
    return true;
  }
}

// Enhanced filter interface with date range
export interface EnhancedModerationFilter extends ModerationFilter {
  dateFrom?: string;
  dateTo?: string;
  authorEmail?: string;
}

// Schema for admin reply
const adminReplySchema = z.object({
  postId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  bodyMd: z.string().min(1, "Reply content is required"),
});

export async function getModerationData(
  filter: EnhancedModerationFilter = {},
  page: number = 1
) {
  await requireAdmin();
  
  const config = new ConfigServiceImpl({ db });
  const pageSize = await config.getNumber("MODERATION.PAGE-SIZE");
  if (pageSize == null) throw new Error("Missing required config: MODERATION.PAGE-SIZE");

  // Convert enhanced filter to base filter for now
  // TODO: Enhance getModerationQueue to support date range filtering
  const baseFilter: ModerationFilter = {
    status: filter.status,
    postId: filter.postId,
    search: filter.search,
  };

  return await getModerationQueue(baseFilter, page, pageSize);
}

export async function performModerationAction(input: ModerateInput) {
  await requireAdmin();

  const repo = new DrizzleModerationRepo();
  const results = await moderateComments(repo, input);

  // Extract post IDs for revalidation
  const postIds: string[] = [];
  if (input.ids?.length) {
    // Get post IDs from the comment IDs
    const commentData = await db.execute(sql`
      SELECT DISTINCT post_id 
      FROM comments 
      WHERE id IN (${sql.join(input.ids.map((id) => sql`${id}`), sql`, `)})
    `);
    
    const rows: any[] = (commentData as any).rows ?? (Array.isArray(commentData) ? commentData : []);
    postIds.push(...rows.map(row => row.post_id));
  } else if (input.id) {
    // Single comment operation
    const commentData = await db.execute(sql`
      SELECT post_id 
      FROM comments 
      WHERE id = ${input.id}
    `);
    
    const rows: any[] = (commentData as any).rows ?? (Array.isArray(commentData) ? commentData : []);
    if (rows[0]?.post_id) {
      postIds.push(rows[0].post_id);
    }
  }

  // Revalidate affected post pages
  if (postIds.length > 0) {
    await revalidateAfterModeration(postIds);
  }

  return { success: true, results };
}

// Get comment with parent context for detailed view
export async function getCommentWithContext(commentId: string) {
  await requireAdmin();

  const commentQuery = sql`
    SELECT 
      c.id,
      c.post_id as "postId",
      c.user_id as "userId",
      c.parent_id as "parentId",
      c.path,
      c.depth,
      c.body_html as "bodyHtml",
      c.body_md as "bodyMd",
      c.status,
      c.created_at as "createdAt",
      u.name as "authorName",
      u.email as "authorEmail",
      u.image as "authorImage",
      p.slug as "postSlug",
      p.title as "postTitle"
    FROM comments c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN posts p ON p.id = c.post_id
    WHERE c.id = ${commentId}
  `;

  const result: any = await db.execute(commentQuery);
  const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);
  const comment = rows[0];
  
  if (!comment) {
    return null;
  }

  // Get parent comment if exists
  let parentComment = null;
  if (comment.parentId) {
    const parentQuery = sql`
      SELECT 
        c.id,
        c.body_html as "bodyHtml",
        c.created_at as "createdAt",
        u.name as "authorName",
        u.email as "authorEmail"
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ${comment.parentId}
    `;
    
    const parentResult: any = await db.execute(parentQuery);
    const parentRows: any[] = (parentResult as any).rows ?? (Array.isArray(parentResult) ? parentResult : []);
    parentComment = parentRows[0] || null;
  }

  // Get attachments
  const attachmentsQuery = sql`
    SELECT id, kind, url, poster_url as "posterUrl", mime, bytes
    FROM comment_attachments
    WHERE comment_id = ${commentId}
    ORDER BY id
  `;
  
  const attachmentResult: any = await db.execute(attachmentsQuery);
  const attachmentRows: any[] = (attachmentResult as any).rows ?? (Array.isArray(attachmentResult) ? attachmentResult : []);

  return {
    comment: {
      id: comment.id,
      postId: comment.postId,
      postSlug: comment.postSlug,
      postTitle: comment.postTitle,
      userId: comment.userId,
      bodyHtml: comment.bodyHtml,
      bodyMd: comment.bodyMd,
      status: comment.status,
      createdAt: comment.createdAt,
      author: {
        name: comment.authorName,
        email: comment.authorEmail,
        image: comment.authorImage,
      },
      attachments: attachmentRows,
    },
    parentComment: parentComment ? {
      id: parentComment.id,
      bodyHtml: parentComment.bodyHtml,
      createdAt: parentComment.createdAt,
      author: {
        name: parentComment.authorName,
        email: parentComment.authorEmail,
      },
    } : null,
  };
}

// Remove individual attachment
export async function removeCommentAttachment(attachmentId: string) {
  await requireAdmin();

  try {
    // Get comment ID for revalidation before deletion
    const attachmentQuery = sql`
      SELECT ca.comment_id, c.post_id
      FROM comment_attachments ca
      JOIN comments c ON c.id = ca.comment_id
      WHERE ca.id = ${attachmentId}
    `;
    
    const result: any = await db.execute(attachmentQuery);
    const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);
    const attachment = rows[0];
    
    if (!attachment) {
      return { error: "Attachment not found" };
    }

    // Remove attachment
    await db.delete(commentAttachments).where(eq(commentAttachments.id, attachmentId));

    // Revalidate post page
    await revalidateAfterModeration([attachment.post_id]);

    return { success: true };
  } catch (error) {
    console.error("Error removing attachment:", error);
    return { error: "Failed to remove attachment" };
  }
}

// Create admin reply to comment
export async function createAdminReply(formData: FormData) {
  await requireAdmin();

  const data = {
    postId: formData.get("postId") as string,
    parentId: formData.get("parentId") as string || undefined,
    bodyMd: formData.get("bodyMd") as string,
  };

  const parsed = adminReplySchema.safeParse(data);
  if (!parsed.success) {
    return { 
      error: parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") 
    };
  }

  const { postId, parentId, bodyMd } = parsed.data;

  try {
    // Get current user (admin) ID - in a real implementation this would come from session
    // For now, we'll create the comment without a user ID to indicate it's from admin
    
    const deps = {
      ensurePostExists: async (postId: string) => {
        const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
        if (!post) throw new Error("Post not found");
      },
      
      getParentComment: async (parentId: string) => {
        const [parent] = await db
          .select({ id: comments.id, postId: comments.postId, depth: comments.depth, path: comments.path })
          .from(comments)
          .where(eq(comments.id, parentId))
          .limit(1);
        
        if (!parent || !parent.postId) return null;
        
        return {
          id: parent.id,
          postId: parent.postId,
          depth: parent.depth,
          path: parent.path,
        };
      },
      
      countSiblings: async (postId: string, parentId: string | null) => {
        const query = parentId
          ? sql`SELECT COUNT(*)::int as count FROM comments WHERE post_id = ${postId} AND parent_id = ${parentId}`
          : sql`SELECT COUNT(*)::int as count FROM comments WHERE post_id = ${postId} AND parent_id IS NULL`;
        
        const result: any = await db.execute(query);
        const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);
        return Number(rows[0]?.count ?? 0);
      },
      
      insertComment: async (data: any) => {
        const [comment] = await db
          .insert(comments)
          .values({
            postId: data.postId,
            parentId: data.parentId,
            userId: null, // Admin comments don't have a user ID
            path: data.path,
            depth: data.depth,
            bodyHtml: data.bodyHtml,
            bodyMd: data.bodyMd,
            status: "approved", // Admin replies are auto-approved
          })
          .returning({ id: comments.id });
        
        if (!comment) {
          throw new Error("Failed to insert comment");
        }
        
        return comment;
      },
      
      sanitizeBody: sanitizeMarkdown,
    };

    const comment = await createCommentCore(deps, {
      postId,
      parentId: parentId || null,
      bodyMd,
      userId: "", // Will be ignored since we pass null in insertComment
    });

    // Revalidate post page
    await revalidateAfterModeration([postId]);

    return { success: true, comment };
  } catch (error) {
    console.error("Error creating admin reply:", error);
    return { error: error instanceof Error ? error.message : "Failed to create reply" };
  }
}

// Hard delete comments with confirmation
export async function hardDeleteComments(commentIds: string[]) {
  await requireAdmin();

  if (!commentIds.length) {
    return { error: "No comments selected" };
  }

  try {
    // Get comment info before deletion for revalidation
    const commentQuery = sql`
      SELECT DISTINCT c.post_id, COUNT(*) as count
      FROM comments c
      WHERE c.id IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})
      GROUP BY c.post_id
    `;
    
    const result: any = await db.execute(commentQuery);
    const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);
    const postIds = rows.map(row => row.post_id);
    const totalCount = rows.reduce((sum, row) => sum + Number(row.count), 0);

    // Hard delete comments (cascades to attachments via foreign key)
    for (const id of commentIds) {
      await db.delete(comments).where(eq(comments.id, id));
    }

    // Revalidate affected post pages
    if (postIds.length > 0) {
      await revalidateAfterModeration(postIds);
    }

    return { success: true, deleted: totalCount };
  } catch (error) {
    console.error("Error hard deleting comments:", error);
    return { error: "Failed to delete comments" };
  }
}

// Get comment counts by status for moderation dashboard
export async function getModerationStats() {
  await requireAdmin();

  const statsQuery = sql`
    SELECT 
      status,
      COUNT(*)::int as count
    FROM comments
    GROUP BY status
  `;

  const result: any = await db.execute(statsQuery);
  const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);

  const stats = {
    pending: 0,
    approved: 0,
    spam: 0,
    deleted: 0,
  };

  rows.forEach(row => {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = Number(row.count);
    }
  });

  return stats;
}