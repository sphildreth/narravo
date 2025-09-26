"use server";
// SPDX-License-Identifier: Apache-2.0
import { getCommentTreeForPost, createCommentCore, sanitizeMarkdown } from "@/lib/comments";
import { ConfigServiceImpl } from "@/lib/config";
import { requireSession } from "@/lib/auth";
import { validateAntiAbuse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { posts, comments, commentAttachments } from "@/drizzle/schema";
import { eq, sql, count } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { enqueueVideoPosterGeneration } from "@/lib/jobs";
import { headers } from "next/headers";

export async function loadReplies(params: { postId: string; parentPath: string | null; already?: number; cursor?: string | null; topLevel?: boolean; }) {
  if (params.topLevel) {
    const config = new ConfigServiceImpl({ db });
    const topPage = await config.getNumber("COMMENTS.TOP-PAGE-SIZE");
    if (topPage == null) throw new Error("Missing required config: COMMENTS.TOP-PAGE-SIZE");
    const repliesPage = await config.getNumber("COMMENTS.REPLIES-PAGE-SIZE");
    if (repliesPage == null) throw new Error("Missing required config: COMMENTS.REPLIES-PAGE-SIZE");
    const r = await getCommentTreeForPost(params.postId, { cursor: params.cursor ?? null, limitTop: topPage, limitReplies: repliesPage });
    return { nodes: r.top, nextCursor: r.nextCursor };
  }
  return { nodes: [], nextCursor: null };
}

interface CommentAttachment {
  key: string;
  url: string;
  kind: "image" | "video";
  mimeType: string;
  size: number;
  name: string;
}

export async function createComment(params: {
  postId: string;
  parentId: string | null;
  bodyMd: string;
  attachments?: CommentAttachment[];
  honeypot?: string;
  submitStartTime?: number;
}) {
  const session = await requireSession();
  const userId = session.user?.id;
  
  if (!userId) {
    throw new Error("User ID not found in session");
  }

  try {
    // Anti-abuse validation including rate limiting
    const requestHeaders = await headers();
    const antiAbuseResult = await validateAntiAbuse(userId, "comment", {
      honeypot: params.honeypot ?? null,
      submitStartTime: params.submitStartTime ?? null,
      headers: requestHeaders
    });

    if (!antiAbuseResult.valid) {
      return {
        success: false,
        error: antiAbuseResult.error,
        rateLimitInfo: antiAbuseResult.rateLimitInfo
      };
    }

    // Validate config
    const config = new ConfigServiceImpl({ db });
    const maxDepth = await config.getNumber("COMMENTS.MAX-DEPTH");
    if (maxDepth == null) throw new Error("Missing required config: COMMENTS.MAX-DEPTH");

    // Create comment using existing core logic
    const deps = {
      ensurePostExists: async (postId: string) => {
        const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
        if (post.length === 0) throw new Error("Post not found");
      },
      getParentComment: async (parentId: string) => {
        const parent = await db.select({
          id: comments.id,
          postId: comments.postId,
          depth: comments.depth,
          path: comments.path,
        }).from(comments).where(eq(comments.id, parentId)).limit(1);
        const result = parent[0] || null;
        if (result && !result.postId) {
          throw new Error("Invalid parent comment: missing postId");
        }
        return result as { id: string; postId: string; depth: number; path: string; } | null;
      },
      countSiblings: async (postId: string, parentId: string | null) => {
        const result = await db.select({ count: count() }).from(comments).where(
          parentId
            ? sql`post_id = ${postId} AND parent_id = ${parentId}`
            : sql`post_id = ${postId} AND parent_id IS NULL`
        );
        return Number(result[0]?.count || 0);
      },
      insertComment: async (data: any) => {
        const result = await db.insert(comments).values({
          postId: data.postId,
          parentId: data.parentId,
          path: data.path,
          depth: data.depth,
          bodyMd: data.bodyMd,
          bodyHtml: data.bodyHtml,
          userId,
          status: 'pending', // Comments start as pending for moderation
        }).returning({ id: comments.id });
        if (!result[0]) {
          throw new Error("Failed to insert comment");
        }
        return result[0];
      },
      sanitizeBody: (md: string) => sanitizeMarkdown(md),
    };

    const result = await createCommentCore(deps, {
      postId: params.postId,
      parentId: params.parentId,
      bodyMd: params.bodyMd,
      userId,
    });

    // Add attachments if provided
    if (params.attachments && params.attachments.length > 0) {
      for (const attachment of params.attachments) {
        const insertedAttachment = await db.insert(commentAttachments).values({
          commentId: result.id,
          kind: attachment.kind,
          url: attachment.url,
          mime: attachment.mimeType,
          bytes: attachment.size,
          posterUrl: attachment.kind === 'image' ? null : undefined, // Only videos need posters
        }).returning({ id: commentAttachments.id });

        if (!insertedAttachment[0]) {
          throw new Error("Failed to insert attachment");
        }

        // Generate poster for videos
        if (attachment.kind === 'video') {
          try {
            await enqueueVideoPosterGeneration(
              insertedAttachment[0].id,
              attachment.url,
              attachment.key
            );
          } catch (error) {
            console.error('Failed to enqueue poster generation:', error);
            // Don't fail the comment creation if poster generation fails
          }
        }
      }
    }

    // Revalidate the post page to show new comment (when approved)
    revalidateTag(`post:${params.postId}`);

    return { success: true, commentId: result.id };

  } catch (error) {
    console.error('Failed to create comment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create comment' 
    };
  }
}
