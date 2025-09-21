// SPDX-License-Identifier: Apache-2.0
import { notFound } from "next/navigation";
import { getPostsByMonth, validateArchiveParams } from "@/lib/archives";
import { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";

interface MonthArchivePageProps {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: MonthArchivePageProps): Promise<Metadata> {
  const { year, month } = await params;
  const validation = validateArchiveParams(year, month);
  
  if (!validation.isValid || !validation.yearNum || !validation.monthNum) {
    return { title: "Archive Not Found" };
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthName = monthNames[validation.monthNum - 1];

  return {
    title: `${monthName} ${validation.yearNum} Archive`,
    description: `Blog posts from ${monthName} ${validation.yearNum}`,
  };
}

export default async function MonthArchivePage({ params, searchParams }: MonthArchivePageProps) {
  const { year, month } = await params;
  const { page: pageParam } = await searchParams;
  
  const validation = validateArchiveParams(year, month);
  if (!validation.isValid || !validation.yearNum || !validation.monthNum) {
    notFound();
  }

  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const { posts, totalCount, totalPages, currentPage, monthLabel } = await getPostsByMonth(
    validation.yearNum, 
    validation.monthNum, 
    page
  );

  if (posts.length === 0 && page === 1) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold">Archive: {monthLabel}</h1>
        <p className="text-muted mt-1">{totalCount} posts</p>
        <nav className="mt-2 text-sm">
          <Link href={`/archive/${validation.yearNum}`} className="text-brand hover:underline">
            {validation.yearNum}
          </Link>
          <span className="text-muted mx-2">/</span>
          <span className="text-muted">{monthLabel}</span>
        </nav>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <article key={post.id} className="space-y-2">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                <Link href={`/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              {post.publishedAt && (
                <time className="text-sm text-muted" dateTime={post.publishedAt.toISOString()}>
                  {format(post.publishedAt, "MMMM d, yyyy")}
                </time>
              )}
            </div>
            {post.excerpt && (
              <p className="text-muted leading-relaxed">{post.excerpt}</p>
            )}
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="flex justify-center gap-2 pt-6 border-t border-border">
          {currentPage > 1 && (
            <Link
              href={`/archive/${validation.yearNum}/${month}?page=${currentPage - 1}`}
              className="px-3 py-2 border border-border rounded hover:bg-muted/20"
            >
              ← Previous
            </Link>
          )}
          
          <span className="px-3 py-2 text-muted">
            Page {currentPage} of {totalPages}
          </span>
          
          {currentPage < totalPages && (
            <Link
              href={`/archive/${validation.yearNum}/${month}?page=${currentPage + 1}`}
              className="px-3 py-2 border border-border rounded hover:bg-muted/20"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

// Enable ISR with tag-based revalidation
export const revalidate = 3600; // 1 hour
export const dynamic = "force-static";