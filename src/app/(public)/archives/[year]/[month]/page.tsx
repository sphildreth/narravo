// SPDX-License-Identifier: Apache-2.0
import { getPostsByYearAndMonth, getPostCountByYearAndMonth } from "@/lib/archives";
import PostList from "@/components/posts/PostList";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

interface MonthPageProps {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function MonthPage({ params, searchParams }: MonthPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const year = parseInt(resolvedParams.year, 10);
  const month = parseInt(resolvedParams.month, 10);
  const page = parseInt(resolvedSearchParams.page || "1", 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return <div>Invalid year or month</div>; // Or render a 404 page
  }

  const config = new ConfigServiceImpl({ db });
  const pageSize = (await config.getNumber("PUBLIC.ARCHIVE.PAGE-SIZE")) ?? 10;

  const posts = await getPostsByYearAndMonth(year, month, page, pageSize);
  const totalPosts = await getPostCountByYearAndMonth(year, month);

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Archive: {monthName} {year}</h1>
      <PostList posts={posts} currentPage={page} pageSize={pageSize} totalPosts={totalPosts} />
    </div>
  );
}
