// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sanitizeCommentHtml } from "./sanitize";
import { markdownToHtmlSync } from "./markdown";
import { getMultipleReactionCounts, getUserReactions, type ReactionCounts, type UserReactions } from "./reactions";

/**
 * The maximum nesting depth allowed for a comment reply.
 * A comment at depth 0 is a top-level comment.
 */
export const MAX_COMMENT_DEPTH = 5;

/**
 * Custom error class for comment-related operations.
 */
export class CommentError extends Error {}

/**
 * Converts a Markdown string to sanitized HTML suitable for comments.
 * @param input The raw Markdown string.
 * @returns Sanitized HTML string.
 */
export function sanitizeMarkdown(input: string): string {
  // Convert markdown to HTML and sanitize for comments
  const html = markdownToHtmlSync(input);
  return sanitizeCommentHtml(html);
}

// Helper to pad a number with leading zeros to a length of 4.
function pad4(n: number) {
  return String(n).padStart(4, "0");
}

/**
 * Core logic for creating a new comment. This function is designed to be testable
 * by injecting its dependencies. It handles path generation, depth calculation,
 * and body sanitization before inserting the comment into the database.
 *
 * @param deps - An object containing dependency functions for database access and sanitization.
 * @param input - The data for the new comment.
 * @returns The newly created comment row from the database.
 * @throws {CommentError} if the parent comment is not found or max depth is exceeded.
 */
export async function createCommentCore(
  deps: {
    ensurePostExists: (postId: string) => Promise<void>;
    getParentComment: (parentId: string) => Promise<{ id: string; postId: string; depth: number; path: string } | null>;
    countSiblings: (postId: string, parentId: string | null) => Promise<number>;
    insertComment: (data: any) => Promise<{ id: string }>;
    sanitizeBody: (md: string) => string;
  },
  input: { postId: string; parentId: string | null; bodyMd: string; userId: string }
) {
  await deps.ensurePostExists(input.postId);

  let depth = 0;
  let pathPrefix = "";
  if (input.parentId) {
    const parent = await deps.getParentComment(input.parentId);
    if (!parent) throw new CommentError("Parent comment not found");
    depth = parent.depth + 1;
    if (depth >= MAX_COMMENT_DEPTH) throw new CommentError("Max depth exceeded");
    pathPrefix = parent.path + ".";
  }

  const siblingCount = await deps.countSiblings(input.postId, input.parentId);
  const seq = siblingCount + 1;
  const path = pathPrefix + pad4(seq);
  const bodyHtml = deps.sanitizeBody(input.bodyMd);

  const row = await deps.insertComment({
    postId: input.postId,
    parentId: input.parentId,
    path,
    depth,
    bodyMd: input.bodyMd,
    bodyHtml,
    userId: input.userId,
  });
  return row;
}

export const __testables__ = { createCommentCore, CommentError, sanitizeMarkdown };

/**
 * Data Transfer Object (DTO) for a comment, representing the structure sent to clients.
 */
export type CommentDTO = { 
  id: string; 
  postId: string; 
  userId: string | null; 
  path: string; 
  depth: number; 
  bodyHtml: string; 
  createdAt: string; 
  author: { name: string | null; image: string | null }; 
  childrenCount?: number | null;
  reactions?: {
    counts: ReactionCounts;
    userReactions: UserReactions;
  };
  attachments?: Array<{
    id: string;
    kind: "image" | "video";
    url: string;
    posterUrl?: string | null;
    mime?: string | null;
  }>;
};

/**
 * Counts the number of approved, non-deleted comments for a given post.
 * @param postId The ID of the post.
 * @returns A promise that resolves to the number of comments.
 */
export async function countApprovedComments(postId: string): Promise<number> {
  const rows = await db.execute(sql`select count(*)::int as c from comments where post_id = ${postId} and status = 'approved' and deleted_at is null`);
  const first = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0];
  return Number(first?.c ?? 0);
}

/**
 * Retrieves a hierarchical tree of comments for a post, with pagination for top-level comments
 * and a limit on replies shown for each.
 * @param postId The ID of the post.
 * @param opts Options for pagination, limits, and user-specific data.
 * @returns A promise that resolves to an object containing top-level comments, a map of children, and a cursor for the next page.
 */
export async function getCommentTreeForPost(postId: string, opts: { cursor?: string | null; limitTop?: number; limitReplies?: number; userId?: string | undefined } = {}) {
  // Set default options
  const limitTop = opts.limitTop ?? 10;
  const limitReplies = opts.limitReplies ?? 3;
  const cursor = opts.cursor ?? null;
  const userId = opts.userId;
  
  const topSql = sql`
    select c.id, c.post_id as "postId", c.user_id as "userId", c.path, c.depth, c.body_html as "bodyHtml",
           -- Fetch author details and a count of direct approved children for each top-level comment
           c.created_at as "createdAt",
           u.name as "authorName", u.image as "authorImage",
           (select count(*)::int from comments c2 where c2.parent_id = c.id and c2.status = 'approved') as "childrenCount"
    from comments c
    left join users u on u.id = c.user_id
    where c.post_id = ${postId}
      and c.status = 'approved'
      and c.deleted_at is null
      and c.depth = 0 -- Only fetch top-level comments
      -- Use path for cursor-based pagination
      ${cursor ? sql`and c.path > ${cursor}` : sql``}
    order by c.path asc
    limit ${limitTop + 1} -- Fetch one extra to check if there are more pages
  `;
  const topRes: any = await db.execute(topSql);
  const topRows: any[] = (topRes as any).rows ?? (Array.isArray(topRes) ? topRes : []);
  
  // Determine if there's a next page and slice the results to the requested limit
  const hasMoreTop = topRows.length > limitTop;
  const topSlice = topRows.slice(0, limitTop).map((r: any) => ({
    id: r.id, postId: r.postId, userId: r.userId ?? null, path: r.path, depth: Number(r.depth),
    bodyHtml: String(r.bodyHtml ?? ""), createdAt: new Date(r.createdAt).toISOString(),
    author: { name: r.authorName ?? null, image: r.authorImage ?? null },
    childrenCount: r.childrenCount ?? null,
  }));

  const parents = topSlice.map((t) => t.path);
  const childrenMap: Record<string, any[]> = {};
  let allComments = [...topSlice];
  
  // If there are top-level comments, fetch all their descendants in a single query.
  if (parents.length > 0) {
    const likeClauses = parents.map((p) => sql`c.path like ${p + ".%"} `);
    // This query fetches all children for the visible top-level comments.
    const childSql = sql`
      select c.id, c.post_id as "postId", c.user_id as "userId", c.path, c.depth, c.body_html as "bodyHtml",
             c.created_at as "createdAt",
             u.name as "authorName", u.image as "authorImage"
      from comments c
      left join users u on u.id = c.user_id
      where c.post_id = ${postId}
        and c.status = 'approved'
        and c.deleted_at is null
        and (
          ${sql.join(likeClauses, sql` or `)}
        )
      order by c.path asc
    `;
    const childRes: any = await db.execute(childSql);
    const childRows: any[] = (childRes as any).rows ?? (Array.isArray(childRes) ? childRes : []);

    // Process and group children by their parent's path, respecting the reply limit.
    for (const row of childRows) {
      const dto = {
        id: row.id, postId: row.postId, userId: row.userId ?? null, path: row.path, depth: Number(row.depth),
        bodyHtml: String(row.bodyHtml ?? ""), createdAt: new Date(row.createdAt).toISOString(),
        author: { name: row.authorName ?? null, image: row.authorImage ?? null },
        childrenCount: null, // Child comments don't have childrenCount
      };
      const parentPath = dto.path.slice(0, dto.path.lastIndexOf("."));
      const arr = (childrenMap[parentPath] ||= []);
      if (arr.length < limitReplies) {
        arr.push(dto);
        allComments.push(dto);
      }
    }
  }

  // Fetch reaction data for all retrieved comments (top-level and children)
  let reactionData: Record<string, { counts: ReactionCounts; userReactions: UserReactions }> = {};
  if (allComments.length > 0) {
    const targets = allComments.map(comment => ({ targetType: "comment" as const, targetId: comment.id }));
    const allCounts = await getMultipleReactionCounts(targets);
    
    if (userId) {
      // Get user reactions for all comments
      for (const comment of allComments) {
        const userReactions = await getUserReactions("comment", comment.id, userId);
        reactionData[comment.id] = {
          counts: allCounts[`comment:${comment.id}`] || {},
          userReactions,
        };
      }
    } else {
      // Just counts, no user reactions
      for (const comment of allComments) {
        reactionData[comment.id] = {
          counts: allCounts[`comment:${comment.id}`] || {},
          userReactions: {},
        };
      }
    }
  }

  // Fetch attachments for all retrieved comments
  let attachmentData: Record<string, any[]> = {};
  if (allComments.length > 0) {
    const commentIds = allComments.map(c => c.id);
    attachmentData = await getCommentAttachments(commentIds);
  }

  // Add reaction data and attachments to comments
  const topSliceWithReactions = topSlice.map(comment => ({
    ...comment,
    reactions: reactionData[comment.id],
    attachments: attachmentData[comment.id] || [],
  }));

  const childrenMapWithReactions: Record<string, any[]> = {};
  for (const [parentPath, children] of Object.entries(childrenMap)) {
    childrenMapWithReactions[parentPath] = children.map(comment => ({
      ...comment,
      reactions: reactionData[comment.id],
      attachments: attachmentData[comment.id] || [],
    }));
  }

  // Determine the cursor for the next page of top-level comments
  const lastTop = topSliceWithReactions.length > 0 ? topSliceWithReactions[topSliceWithReactions.length - 1] : undefined;
  const nextCursor = hasMoreTop && lastTop ? lastTop.path : null;

  return { top: topSliceWithReactions, children: childrenMapWithReactions, nextCursor };
}

/**
 * Retrieves attachments for a given list of comment IDs.
 * @param commentIds An array of comment IDs.
 * @returns A promise that resolves to a record mapping each comment ID to an array of its attachments.
 */
export async function getCommentAttachments(commentIds: string[]): Promise<Record<string, Array<{
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
  mime?: string | null;
}>>> {
  if (commentIds.length === 0) return {};
  
  const attachments = await db.execute(sql`
    select comment_id as "commentId", id, kind, url, poster_url as "posterUrl", mime
    from comment_attachments
    where comment_id IN (${sql.join(commentIds.map((id) => sql`${id}`), sql`, `)})
      and deleted_at is null
    order by comment_id, id
  `);
  
  const attachmentRows: any[] = (attachments as any).rows ?? (Array.isArray(attachments) ? attachments : []);
  const result: Record<string, any[]> = {};
  
  for (const row of attachmentRows) {
    const commentId = row.commentId;
    if (!result[commentId]) result[commentId] = [];
    result[commentId].push({
      id: row.id,
      kind: row.kind,
      url: row.url,
      posterUrl: row.posterUrl,
      mime: row.mime,
    });
  }
  
  return result;
}

/**
 * Counts the number of comments with a 'pending' status.
 * @returns A promise that resolves to the count of pending comments.
 */
export async function countPendingComments(): Promise<number> {
  const rows = await db.execute(
    sql`select count(*)::int as c from comments where status = 'pending' and deleted_at is null`
  );
  const first = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0];
  return Number(first?.c ?? 0);
}

/**
 * Counts the number of comments marked as 'spam'.
 * @returns A promise that resolves to the count of spam comments.
 */
export async function countSpamComments(): Promise<number> {
  const rows = await db.execute(
    sql`select count(*)::int as c from comments where status = 'spam'`
  );
  const first = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0];
  return Number(first?.c ?? 0);
}

/**
 * Retrieves a list of the most recent comments across all posts.
 * @param limit The maximum number of recent comments to fetch. Defaults to 5.
 * @returns A promise that resolves to an array of recent comment objects.
 */
export async function getRecentComments(limit = 5) {
  const res: any = await db.execute(sql`
    select c.id, c.body_html as "bodyHtml", c.created_at as "createdAt",
           u.name as "authorName", u.image as "authorImage",
           p.slug as "postSlug"
    from comments c
    left join users u on u.id = c.user_id
    left join posts p on p.id = c.post_id
    order by c.created_at desc
    limit ${limit}
  `);

  const rows: any[] = res.rows ?? (Array.isArray(res) ? res : []);
  return rows.map((r) => ({
    id: r.id,
    bodyHtml: r.bodyHtml,
    createdAt: new Date(r.createdAt).toISOString(),
    author: { name: r.authorName ?? null, image: r.authorImage ?? null },
    postSlug: r.postSlug ?? null,
  }));
}
