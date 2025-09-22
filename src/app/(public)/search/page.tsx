// SPDX-License-Identifier: Apache-2.0
import Link from "next/link";
import { redirect } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import { searchPosts } from "@/lib/search";

interface SearchPageProps {
  searchParams: { q?: string; page?: string; pageSize?: string };
}

export const dynamic = "force-dynamic"; // user specific input; no cache

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = (searchParams.q ?? "").trim();
  if (!q) {
    redirect("/");
  }
  const page = Number.parseInt(searchParams.page ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.pageSize ?? "10", 10);

  let result;
  try {
    result = await searchPosts({ q, page: Number.isNaN(page) ? 1 : page, pageSize: Number.isNaN(pageSize) ? 10 : pageSize });
  } catch {
    // On validation error, redirect home for MVP
    redirect("/");
  }

  const { items, pagination } = result;
  const hasPrev = (pagination.page ?? 1) > 1;
  const hasNext = !!pagination.hasMore;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-extrabold mb-4">Search results for “{q}”</h1>
      {items.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-muted">
          No posts match “{q}”. Try a different search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {items.map((post) => (
            <ArticleCard key={post.id} post={post as any} />
          ))}
        </div>
      )}

      {(hasPrev || hasNext) && (
        <div className="mt-8 flex items-center justify-between text-sm">
          {hasPrev ? (
            <Link
              className="inline-flex items-center h-9 px-3 rounded-xl border border-border hover:border-accent"
              href={`/search?q=${encodeURIComponent(q)}&page=${(pagination.page ?? 1) - 1}&pageSize=${pagination.pageSize}`}
            >
              ← Previous
            </Link>
          ) : <span />}
          <span className="text-muted">Page {pagination.page} • {items.length} result{items.length === 1 ? "" : "s"}</span>
          {hasNext ? (
            <Link
              className="inline-flex items-center h-9 px-3 rounded-xl border border-border hover:border-accent"
              href={`/search?q=${encodeURIComponent(q)}&page=${(pagination.page ?? 1) + 1}&pageSize=${pagination.pageSize}`}
            >
              Next →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
