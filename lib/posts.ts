import { unstable_cache } from "next/cache";
import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "./db";
import { posts } from "../drizzle/schema";

type PostSelect = typeof posts.$inferSelect;

type PostSummary = Pick<PostSelect, "id" | "slug" | "title" | "excerpt" | "publishedAt" | "createdAt">;

interface ListPostsParams {
  page?: number;
  pageSize?: number;
}

interface PaginationInput {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export interface PaginatedPosts {
  items: PostSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const postById = (id: string) =>
  unstable_cache(
    async () => {
      const [row] = await db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          html: posts.html,
          excerpt: posts.excerpt,
          publishedAt: posts.publishedAt,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .where(eq(posts.id, id))
        .limit(1);

      return row ?? null;
    },
    ["posts", "by-id", id],
    { tags: [`post:${id}`] }
  );

const postsSortOrder = desc(sql`coalesce(${posts.publishedAt}, ${posts.createdAt})`);

const listPostsCached = (page: number, pageSize: number, offset: number) =>
  unstable_cache(
    async () => {
      const [items, [{ total } = { total: 0 }]] = await Promise.all([
        db
          .select({
            id: posts.id,
            slug: posts.slug,
            title: posts.title,
            excerpt: posts.excerpt,
            publishedAt: posts.publishedAt,
            createdAt: posts.createdAt,
          })
          .from(posts)
          .orderBy(postsSortOrder, desc(posts.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ total: count() }).from(posts),
      ]);

      const totalNumber = typeof total === "number" ? total : Number(total ?? 0);
      const totalPages = totalNumber === 0 ? 1 : Math.ceil(totalNumber / pageSize);

      return {
        items,
        page,
        pageSize,
        total: totalNumber,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      } satisfies PaginatedPosts;
    },
    ["posts", "list", `page:${page}`, `size:${pageSize}`],
    { tags: ["posts:list", `posts:list:page:${page}`] }
  );

const normalizePagination = ({ page, pageSize }: ListPostsParams = {}): PaginationInput => {
  const safePage = Number.isInteger(page) && page ? Math.max(page, 1) : 1;
  const safePageSize = Number.isInteger(pageSize)
    ? Math.min(Math.max(pageSize as number, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  const limit = safePageSize;
  const offset = (safePage - 1) * safePageSize;

  return { page: safePage, pageSize: safePageSize, limit, offset };
};

export const getPostBySlug = async (slug: string) => {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.slug, slug))
    .limit(1);

  if (!row) return null;

  return postById(row.id)();
};

export const listPosts = async (params?: ListPostsParams): Promise<PaginatedPosts> => {
  const { page, pageSize, offset } = normalizePagination(params ?? {});
  return listPostsCached(page, pageSize, offset)();
};

export const __testables__ = {
  normalizePagination,
};

export type { PostSelect as PostRecord, PostSummary, ListPostsParams };
