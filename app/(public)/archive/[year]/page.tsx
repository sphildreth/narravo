// SPDX-License-Identifier: Apache-2.0
import { notFound } from "next/navigation";
import { getPostsByYear, validateArchiveParams, getArchiveCacheTag } from "@/lib/archives";
import { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { revalidateTag } from "next/cache";

interface YearArchivePageProps {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: YearArchivePageProps): Promise<Metadata> {
  const { year } = await params;
  const validation = validateArchiveParams(year);
  
  if (!validation.isValid || !validation.yearNum) {
    return { title: "Archive Not Found" };
  }

  return {
    title: `${validation.yearNum} Archive`,
    description: `Blog posts from ${validation.yearNum}`,
  };
}

export default async function YearArchivePage({ params, searchParams }: YearArchivePageProps) {
  const { year } = await params;
  const { page: pageParam } = await searchParams;
  
  const validation = validateArchiveParams(year);
  if (!validation.isValid || !validation.yearNum) {
    notFound();
  }

  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const { posts, totalCount, totalPages, currentPage } = await getPostsByYear(validation.yearNum, page);

  if (posts.length === 0 && page === 1) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold">Archive: {validation.yearNum}</h1>
        <p className="text-muted mt-1">{totalCount} posts</p>
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
              href={`/archive/${validation.yearNum}?page=${currentPage - 1}`}
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
              href={`/archive/${validation.yearNum}?page=${currentPage + 1}`}
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

export async function generateStaticParams() {
  // Generate static params for recent years
  const currentYear = new Date().getFullYear();
  const years = [];
  
  // Generate for current year and past 5 years
  for (let i = 0; i < 6; i++) {
    years.push({ year: (currentYear - i).toString() });
  }
  
  return years;
}