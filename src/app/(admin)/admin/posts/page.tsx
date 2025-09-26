// SPDX-License-Identifier: Apache-2.0
import { Suspense } from "react";
import { getPostsWithFilters, type PostsFilter, type PostsSortOptions } from "./actions";
import PostsManager from "@/components/admin/posts/PostsManager";

interface SearchParams {
  search?: string;
  status?: "published" | "draft";
  dateFrom?: string;
  dateTo?: string;
  hasComments?: string;
  sortField?: "updatedAt" | "publishedAt" | "title";
  sortDirection?: "asc" | "desc";
  page?: string;
}

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  
  const filter: PostsFilter = {
    ...(resolvedSearchParams.search && { search: resolvedSearchParams.search }),
    ...(resolvedSearchParams.status && { status: resolvedSearchParams.status }),
    ...(resolvedSearchParams.dateFrom && { dateFrom: resolvedSearchParams.dateFrom }),
    ...(resolvedSearchParams.dateTo && { dateTo: resolvedSearchParams.dateTo }),
    ...(resolvedSearchParams.hasComments && { hasComments: resolvedSearchParams.hasComments === "true" }),
  };

  const sort: PostsSortOptions = {
    field: resolvedSearchParams.sortField || "updatedAt",
    direction: resolvedSearchParams.sortDirection || "desc",
  };  return (
    <main className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Posts</h1>
        <p className="text-muted-foreground">Manage blog posts</p>
      </div>

      <Suspense
        fallback={
          <div className="p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading posts...</p>
          </div>
        }
      >
        <PostsManagerWrapper filter={filter} sort={sort} page={page} />
      </Suspense>
    </main>
  );
}

async function PostsManagerWrapper({ 
  filter, 
  sort,
  page 
}: { 
  filter: PostsFilter; 
  sort: PostsSortOptions;
  page: number; 
}) {
  const data = await getPostsWithFilters(filter, sort, page);
  return <PostsManager initialData={data} filter={filter} sort={sort} page={page} />;
}

