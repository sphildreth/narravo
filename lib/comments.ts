import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sanitizeHtml } from "./sanitize";

export const MAX_COMMENT_DEPTH = 5;

export class CommentError extends Error {}

export function sanitizeMarkdown(input: string): string {
  // For tests, we treat input as HTML and sanitize it.
  return sanitizeHtml(input);
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

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

export type CommentDTO = { id: string; postId: string; userId: string | null; path: string; depth: number; bodyHtml: string; createdAt: string; author: { name: string | null; image: string | null }; childrenCount?: number | null; };
export async function countApprovedComments(postId: string): Promise<number> {
  const rows = await db.execute(sql`select count(*)::int as c from comments where post_id = ${postId} and status = 'approved'`);
  const first = Array.isArray(rows) ? rows[0] : (rows as any).rows?.[0];
  return Number(first?.c ?? 0);
}
export async function getCommentTreeForPost(postId: string, opts: { cursor?: string | null; limitTop?: number; limitReplies?: number } = {}) {
  const limitTop = opts.limitTop ?? 10;
  const limitReplies = opts.limitReplies ?? 3;
  const cursor = opts.cursor ?? null;
  const topSql = sql`
    select c.id, c.post_id as "postId", c.user_id as "userId", c.path, c.depth, c.body_html as "bodyHtml",
           c.created_at as "createdAt",
           u.name as "authorName", u.image as "authorImage",
           c.children_count as "childrenCount"
    from comments c
    left join users u on u.id = c.user_id
    where c.post_id = ${postId}
      and c.status = 'approved'
      and c.depth = 0
      ${cursor ? sql`and c.path > ${cursor}` : sql``}
    order by c.path asc
    limit ${limitTop + 1}
  `;
  const topRes: any = await db.execute(topSql);
  const topRows: any[] = (topRes as any).rows ?? (Array.isArray(topRes) ? topRes : []);
  const hasMoreTop = topRows.length > limitTop;
  const topSlice = topRows.slice(0, limitTop).map((r: any) => ({
    id: r.id, postId: r.postId, userId: r.userId ?? null, path: r.path, depth: Number(r.depth),
    bodyHtml: String(r.bodyHtml ?? ""), createdAt: new Date(r.createdAt).toISOString(),
    author: { name: r.authorName ?? null, image: r.authorImage ?? null },
    childrenCount: r.childrenCount ?? null,
  }));
  const parents = topSlice.map((t) => t.path);
  const childrenMap: Record<string, any[]> = {};
  if (parents.length > 0) {
    const likeClauses = parents.map((p) => sql`c.path like ${p + ".%"} `);
    const childSql = sql`
      select c.id, c.post_id as "postId", c.user_id as "userId", c.path, c.depth, c.body_html as "bodyHtml",
             c.created_at as "createdAt",
             u.name as "authorName", u.image as "authorImage"
      from comments c
      left join users u on u.id = c.user_id
      where c.post_id = ${postId}
        and c.status = 'approved'
        and (
          ${sql.join(likeClauses, sql` or `)}
        )
      order by c.path asc
    `;
    const childRes: any = await db.execute(childSql);
    const childRows: any[] = (childRes as any).rows ?? (Array.isArray(childRes) ? childRes : []);
    for (const row of childRows) {
      const dto = {
        id: row.id, postId: row.postId, userId: row.userId ?? null, path: row.path, depth: Number(row.depth),
        bodyHtml: String(row.bodyHtml ?? ""), createdAt: new Date(row.createdAt).toISOString(),
        author: { name: row.authorName ?? null, image: row.authorImage ?? null },
      };
      const parentPath = dto.path.slice(0, dto.path.lastIndexOf("."));
      const arr = (childrenMap[parentPath] ||= []);
      if (arr.length < limitReplies) arr.push(dto);
    }
  }
  const lastTop = topSlice.length > 0 ? topSlice[topSlice.length - 1] : undefined;
  const nextCursor = hasMoreTop && lastTop ? lastTop.path : null;
  return { top: topSlice, children: childrenMap, nextCursor };
}
