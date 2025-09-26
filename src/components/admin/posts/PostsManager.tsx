"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { performBulkAction, type PostsFilter, type PostsSortOptions } from "@/app/(admin)/admin/posts/actions";
import { useDateFormat } from "@/lib/dateFormat.client";
import { formatDateSafe } from "@/lib/dateFormat";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  totalPages: number;
}

interface PostsData {
  items: Post[];
  pagination: PaginationInfo;
}

interface PostsManagerProps {
  initialData: PostsData;
  filter: PostsFilter;
  sort: PostsSortOptions;
  page: number;
}

export default function PostsManager({ initialData, filter, sort, page }: PostsManagerProps) {
  const router = useRouter();
  const fmt = useDateFormat();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const { items, pagination } = initialData;

  // Update URL with new search parameters
  const updateUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filters change
    if (updates.search !== undefined || updates.status !== undefined || updates.dateFrom !== undefined || updates.dateTo !== undefined) {
      params.set("page", "1");
    }

    const newUrl = `/admin/posts?${params.toString()}`;
    router.push(newUrl);
  };

  // Handle individual selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(p => p.id)));
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: "publish" | "unpublish" | "delete") => {
    if (selectedIds.size === 0) return;
    
    const confirmMessage = action === "delete" 
      ? `Are you sure you want to delete ${selectedIds.size} post(s)? This will also delete all associated comments.`
      : `Are you sure you want to ${action} ${selectedIds.size} post(s)?`;
      
    if (!confirm(confirmMessage)) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("action", action);
      selectedIds.forEach(id => formData.append("ids", id));
      
      const result = await performBulkAction(formData);
      
      if (result.success) {
        setSelectedIds(new Set());
        router.refresh();
      } else {
        alert(result.error || "Failed to perform action");
      }
    } catch (error) {
      console.error("Bulk action error:", error);
      alert("An error occurred while performing the action");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search title or slug..."
              defaultValue={filter.search || ""}
              onChange={(e) => updateUrl({ search: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              id="status"
              defaultValue={filter.status || ""}
              onChange={(e) => updateUrl({ status: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            >
              <option value="">All Posts</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label htmlFor="dateFrom" className="block text-sm font-medium mb-1">
              From Date
            </label>
            <input
              id="dateFrom"
              type="date"
              defaultValue={filter.dateFrom || ""}
              onChange={(e) => updateUrl({ dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>

          {/* Date To */}
          <div>
            <label htmlFor="dateTo" className="block text-sm font-medium mb-1">
              To Date
            </label>
            <input
              id="dateTo"
              type="date"
              defaultValue={filter.dateTo || ""}
              onChange={(e) => updateUrl({ dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>
        </div>

        {/* Sort Options */}
        <div className="mt-4 flex gap-4 items-end">
          <div>
            <label htmlFor="sortField" className="block text-sm font-medium mb-1">
              Sort By
            </label>
            <select
              id="sortField"
              defaultValue={sort.field}
              onChange={(e) => updateUrl({ sortField: e.target.value })}
              className="px-3 py-2 border border-border rounded-md text-sm"
            >
              <option value="updatedAt">Updated</option>
              <option value="publishedAt">Published</option>
              <option value="title">Title</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="sortDirection" className="block text-sm font-medium mb-1">
              Order
            </label>
            <select
              id="sortDirection"
              defaultValue={sort.direction}
              onChange={(e) => updateUrl({ sortDirection: e.target.value })}
              className="px-3 py-2 border border-border rounded-md text-sm"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div className="ml-auto">
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Create Post
            </Link>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedIds.size} post(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction("publish")}
                disabled={isProcessing}
                className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50"
              >
                Publish
              </button>
              <button
                onClick={() => handleBulkAction("unpublish")}
                disabled={isProcessing}
                className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50"
              >
                Unpublish
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={isProcessing}
                className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-sm text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Posts Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium">Title</th>
                <th className="px-3 py-3 text-left font-medium">Slug</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-left font-medium">Published</th>
                <th className="px-3 py-3 text-left font-medium">Updated</th>
                <th className="px-3 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(post.id)}
                      onChange={() => toggleSelection(post.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="max-w-[300px]">
                      <div className="font-medium truncate" title={post.title}>
                        {post.title}
                      </div>
                      {post.excerpt && (
                        <div className="text-xs text-muted-foreground truncate mt-1" title={post.excerpt}>
                          {post.excerpt}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <code className="text-xs">{post.slug}</code>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        post.publishedAt
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {post.publishedAt ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {post.publishedAt ? formatDateSafe(post.publishedAt, fmt) : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {post.updatedAt ? formatDateSafe(post.updatedAt, fmt) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/${post.slug}`}
                        target="_blank"
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No posts found matching your criteria.
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total} posts
          </div>
          
          <div className="flex items-center gap-2">
            {pagination.page > 1 && (
              <button
                onClick={() => updateUrl({ page: (pagination.page - 1).toString() })}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20"
              >
                Previous
              </button>
            )}
            
            <span className="px-3 py-1 text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            {pagination.page < pagination.totalPages && (
              <button
                onClick={() => updateUrl({ page: (pagination.page + 1).toString() })}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}