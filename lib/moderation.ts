// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export interface ModerationComment {
  id: string;
  postId: string;
  postSlug: string;
  postTitle: string;
  userId: string | null;
  bodyHtml: string;
  bodyMd: string | null;
  status: string;
  createdAt: string;
  author: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  attachments: Array<{
    id: string;
    kind: "image" | "video";
    url: string;
    posterUrl?: string | null;
    mime?: string | null;
  }>;
}

export interface ModerationFilter {
  status?: "pending" | "spam" | "approved" | "deleted" | undefined;
  postId?: string | undefined;
  search?: string | undefined;
}

export interface ModerationResult {
  comments: ModerationComment[];
  totalCount: number;
  hasMore: boolean;
}

export async function getModerationQueue(
  filter: ModerationFilter = {},
  page: number = 1,
  pageSize: number = 20
): Promise<ModerationResult> {
  const offset = Math.max(0, (page - 1) * pageSize);
  const limit = Math.max(1, Math.min(100, pageSize));

  // Build WHERE clause based on filter
  const whereConditions: any[] = [];
  const parameters: any[] = [];

  if (filter.status) {
    whereConditions.push(sql`c.status = ${filter.status}`);
  }

  if (filter.postId) {
    whereConditions.push(sql`c.post_id = ${filter.postId}`);
  }

  if (filter.search && filter.search.trim()) {
    const searchTerm = `%${filter.search.trim()}%`;
    whereConditions.push(sql`(
      c.body_html ilike ${searchTerm} 
      OR c.body_md ilike ${searchTerm}
      OR u.name ilike ${searchTerm}
      OR u.email ilike ${searchTerm}
      OR p.title ilike ${searchTerm}
    )`);
  }

  const whereClause = whereConditions.length > 0 
    ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
    : sql``;

  // Get total count
  const countSql = sql`
    SELECT count(*)::int as total
    FROM comments c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN posts p ON p.id = c.post_id
    ${whereClause}
  `;

  const countResult: any = await db.execute(countSql);
  const countRows: any[] = (countResult as any).rows ?? (Array.isArray(countResult) ? countResult : []);
  const totalCount = Number(countRows[0]?.total ?? 0);

  // Get paginated results
  const dataSql = sql`
    SELECT 
      c.id,
      c.post_id as "postId",
      c.user_id as "userId", 
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
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const dataResult: any = await db.execute(dataSql);
  const dataRows: any[] = (dataResult as any).rows ?? (Array.isArray(dataResult) ? dataResult : []);

  // Get attachment data for all comments
  const commentIds = dataRows.map(row => row.id);
  const attachmentData = commentIds.length > 0 ? await getCommentAttachments(commentIds) : {};

  const comments: ModerationComment[] = dataRows.map(row => ({
    id: row.id,
    postId: row.postId,
    postSlug: row.postSlug || '',
    postTitle: row.postTitle || 'Untitled',
    userId: row.userId,
    bodyHtml: row.bodyHtml || '',
    bodyMd: row.bodyMd,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    author: {
      name: row.authorName,
      email: row.authorEmail, 
      image: row.authorImage,
    },
    attachments: attachmentData[row.id] || [],
  }));

  const hasMore = offset + limit < totalCount;

  return {
    comments,
    totalCount,
    hasMore,
  };
}

// Get attachments for comments (reused from comments.ts pattern)
async function getCommentAttachments(commentIds: string[]): Promise<Record<string, Array<{
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
  mime?: string | null;
}>>> {
  if (commentIds.length === 0) return {};
  
  const attachments = await db.execute(sql`
    SELECT comment_id as "commentId", id, kind, url, poster_url as "posterUrl", mime
    FROM comment_attachments
    WHERE comment_id IN (${sql.join(commentIds.map((id) => sql`${id}`), sql`, `)})
    ORDER BY comment_id, id
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

export async function revalidateAfterModeration(postIds: string[]) {
  // Revalidate the post pages where comments were moderated
  for (const postId of postIds) {
    revalidateTag(`post:${postId}`);
  }
  
  // Also revalidate home page since comment counts may have changed
  revalidateTag("home");
}