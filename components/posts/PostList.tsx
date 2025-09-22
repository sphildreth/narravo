// SPDX-License-Identifier: Apache-2.0
import { listPosts } from "@/lib/posts";
import PostCard from "./PostCard";
import MorePosts from "./MorePosts";
import Link from "next/link";

// Support both feed mode (cursor-based) and archive mode (server-paginated)
type ArchivePost = {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt: Date | string | null;
};

type FeedProps = { initialCursor?: any; pageSize?: number };

type ArchiveProps = {
  posts: ArchivePost[];
  currentPage: number;
  pageSize: number;
  totalPosts: number;
};

export default async function PostList(props: FeedProps | ArchiveProps) {
  // Archive mode: posts prop provided
  if ("posts" in props) {
    const { posts, currentPage, pageSize, totalPosts } = props;
    const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));
    return (
      <div className="grid gap-6">
        {posts.map((p: any) => (
          <PostCard key={p.id ?? p.slug} post={p} />
        ))}
        <ArchivePagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    );
  }

  // Feed mode: fallback to cursor-based loading
  const { initialCursor = null, pageSize = 10 } = props;
  const { items, nextCursor } = await listPosts({ cursor: initialCursor, limit: pageSize });
  return (
    <div className="grid gap-6">
      {items.map((p: any) => (
        <PostCard key={p.id} post={p} />
      ))}
      <div className="flex justify-center">
        <MorePosts initialCursor={nextCursor} pageSize={pageSize} />
      </div>
    </div>
  );
}

function ArchivePagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  return (
    <nav className="flex items-center justify-center gap-3 text-sm">
      {prevPage ? (
        <Link className="text-brand" href={`?page=${prevPage}`}>
          Previous
        </Link>
      ) : (
        <span className="text-muted">Previous</span>
      )}
      <span className="text-muted">Page {currentPage} of {totalPages}</span>
      {nextPage ? (
        <Link className="text-brand" href={`?page=${nextPage}`}>
          Next
        </Link>
      ) : (
        <span className="text-muted">Next</span>
      )}
    </nav>
  );
}
