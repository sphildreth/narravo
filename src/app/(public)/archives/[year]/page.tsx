// SPDX-License-Identifier: Apache-2.0
import { getPostsByYear, getPostCountByYear } from "@/lib/archives";
import PostList from "@/components/posts/PostList";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

interface YearPageProps {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function YearPage({ params, searchParams }: YearPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const year = parseInt(resolvedParams.year, 10);
  const page = parseInt(resolvedSearchParams.page || "1", 10);

  if (isNaN(year)) {
    return <div>Invalid year</div>; // Or render a 404 page
  }

  const config = new ConfigServiceImpl({ db });
  const pageSize = (await config.getNumber("PUBLIC.ARCHIVE.PAGE-SIZE")) ?? 10;

  const posts = await getPostsByYear(year, page, pageSize);
  const totalPosts = await getPostCountByYear(year);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Archive: {year}</h1>
      <PostList posts={posts} currentPage={page} pageSize={pageSize} totalPosts={totalPosts} />
    </div>
  );
}
