import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { eq, isNull, and, count, asc } from "drizzle-orm";
import { z } from "zod";

import { db } from "./db";
import { comments, posts, users } from "../drizzle/schema";
import { makeChildPath } from "./commentsPath";
import { sanitizeHtml } from "./sanitize";
import { requireSession } from "./auth";

const MAX_COMMENT_DEPTH = 4;

export type CommentRecord = typeof comments.$inferSelect;

export interface CommentWithAuthor {
  id: string;
  postId: string;
  parentId: string | null;
  path: string;
  depth: number;
  bodyHtml: string;
  bodyMd: string | null;
  status: string;
  createdAt: Date | null;
  userId: string | null;
  author: {
    id: string | null;
    name: string | null;
    image: string | null;
  };
}

const createCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  bodyMd: z.string().trim().min(1, "Comment cannot be empty").max(5000, "Comment too long"),
});

class CommentError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "CommentError";
  }
}

const markdownToHtml = (body: string) => {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "";
  const paragraphs = trimmed.split(/\n{2,}/).map((paragraph) => {
    const withBreaks = paragraph.replace(/\n/g, "<br />");
    return `<p>${withBreaks}</p>`;
  });
  return paragraphs.join("\n");
};

const sanitizeMarkdown = (body: string) => {
  const rawHtml = markdownToHtml(body);
  return sanitizeHtml(rawHtml || "<p></p>");
};

const getParentComment = async (parentId: string) => {
  const [row] = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      depth: comments.depth,
      path: comments.path,
    })
    .from(comments)
    .where(eq(comments.id, parentId))
    .limit(1);

  return row ?? null;
};

const countSiblings = async (postId: string, parentId: string | null) => {
  const [result] = await db
    .select({ total: count() })
    .from(comments)
    .where(
      and(
        eq(comments.postId, postId),
        parentId ? eq(comments.parentId, parentId) : isNull(comments.parentId)
      )
    );

  return Number(result?.total ?? 0);
};

const insertComment = async (values: typeof comments.$inferInsert) => {
  const [inserted] = await db
    .insert(comments)
    .values(values)
    .returning({
      id: comments.id,
      postId: comments.postId,
      parentId: comments.parentId,
      path: comments.path,
      depth: comments.depth,
      bodyHtml: comments.bodyHtml,
      bodyMd: comments.bodyMd,
      status: comments.status,
      createdAt: comments.createdAt,
      userId: comments.userId,
    });

  if (!inserted) throw new Error("Failed to create comment");
  return inserted;
};

const ensurePostExists = async (postId: string) => {
  const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) {
    throw new CommentError("Post not found", 404);
  }
};

const enforceCommentRateLimit = async (_: { userId: string; postId: string }) => Promise.resolve();

type CommentDependencies = {
  ensurePostExists: (postId: string) => Promise<void>;
  getParentComment: (parentId: string) => Promise<{ id: string; postId: string; depth: number; path: string } | null>;
  countSiblings: (postId: string, parentId: string | null) => Promise<number>;
  insertComment: (values: typeof comments.$inferInsert) => Promise<CommentRecord>;
  sanitizeBody: (body: string) => string;
};

const defaultDeps: CommentDependencies = {
  ensurePostExists,
  getParentComment,
  countSiblings,
  insertComment,
  sanitizeBody: sanitizeMarkdown,
};

const createCommentCore = async (
  deps: CommentDependencies,
  {
    postId,
    parentId,
    bodyMd,
    userId,
  }: {
    postId: string;
    parentId: string | null;
    bodyMd: string;
    userId: string;
  }
) => {
  await deps.ensurePostExists(postId);

  const trimmedBody = bodyMd.trim();
  if (!trimmedBody) {
    throw new CommentError("Comment cannot be empty", 400);
  }

  const sanitizedBody = deps.sanitizeBody(trimmedBody);

  let parent: { id: string; postId: string; depth: number; path: string } | null = null;
  if (parentId) {
    parent = await deps.getParentComment(parentId);
    if (!parent || parent.postId !== postId) {
      throw new CommentError("Parent comment not found", 400);
    }
    if (parent.depth >= MAX_COMMENT_DEPTH - 1) {
      throw new CommentError("Maximum depth reached", 400);
    }
  }

  const siblingCount = await deps.countSiblings(postId, parentId ?? null);
  const path = makeChildPath(parent?.path ?? null, siblingCount + 1);
  const depth = parent ? parent.depth + 1 : 0;

  const inserted = await deps.insertComment({
    postId,
    parentId,
    path,
    depth,
    bodyMd: trimmedBody,
    bodyHtml: sanitizedBody,
    userId,
    status: "pending",
  });

  return { ...inserted };
};

const listCommentsForPostCached = (postId: string) =>
  unstable_cache(
    async (): Promise<CommentWithAuthor[]> => {
      const rows = await db
        .select({
          id: comments.id,
          postId: comments.postId,
          parentId: comments.parentId,
          path: comments.path,
          depth: comments.depth,
          bodyHtml: comments.bodyHtml,
          bodyMd: comments.bodyMd,
          status: comments.status,
          createdAt: comments.createdAt,
          userId: comments.userId,
          authorId: users.id,
          authorName: users.name,
          authorImage: users.image,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.postId, postId))
        .orderBy(asc(comments.path));

      return rows.map((row) => ({
        id: row.id,
        postId: row.postId,
        parentId: row.parentId,
        path: row.path,
        depth: row.depth,
        bodyHtml: row.bodyHtml,
        bodyMd: row.bodyMd,
        status: row.status,
        createdAt: row.createdAt,
        userId: row.userId,
        author: {
          id: row.authorId ?? null,
          name: row.authorName ?? null,
          image: row.authorImage ?? null,
        },
      }));
    },
    ["comments", postId],
    { tags: [`comments:post:${postId}`] }
  );

export const listCommentsForPost = async (postId: string) => listCommentsForPostCached(postId)();

export async function createComment(
  bound: { postId: string; parentId: string | null; slug: string },
  formData: FormData
) {
  "use server";
  const session = await requireSession();
  const parsed = createCommentSchema.safeParse({
    postId: bound.postId,
    parentId: bound.parentId,
    bodyMd: (formData.get("bodyMd") ?? "") as string,
  });

  if (!parsed.success) {
    throw new CommentError(parsed.error.errors[0]?.message ?? "Invalid input", 400);
  }

  await enforceCommentRateLimit({ userId: session.user.id, postId: parsed.data.postId });

  const comment = await createCommentCore(defaultDeps, {
    postId: parsed.data.postId,
    parentId: parsed.data.parentId ?? null,
    bodyMd: parsed.data.bodyMd,
    userId: session.user.id,
  });

  revalidateTag(`post:${parsed.data.postId}`);
  revalidateTag(`comments:post:${parsed.data.postId}`);

  redirect(`/${bound.slug}#comment-${comment.id}`);
}

export const __testables__ = {
  createCommentCore,
  sanitizeMarkdown,
  markdownToHtml,
  CommentError,
};

export { MAX_COMMENT_DEPTH };
