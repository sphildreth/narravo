"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { performModerationAction } from "@/app/(admin)/admin/moderation/actions";
import type { ModerationResult, ModerationComment, ModerationFilter } from "@/lib/moderation";
import type { ModerateAction } from "@/lib/adminModeration";

interface ModerationQueueProps {
  initialData: ModerationResult;
  filter: ModerationFilter;
  page: number;
}

export default function ModerationQueue({ initialData, filter, page }: ModerationQueueProps) {
  const [data, setData] = useState(initialData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (newFilter: Partial<ModerationFilter>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newFilter.status !== undefined) {
      if (newFilter.status) {
        params.set("status", newFilter.status);
      } else {
        params.delete("status");
      }
    }
    
    if (newFilter.search !== undefined) {
      if (newFilter.search) {
        params.set("search", newFilter.search);
      } else {
        params.delete("search");
      }
    }
    
    params.delete("page"); // Reset to page 1 when filtering
    router.push(`/admin/moderation?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/moderation?${params.toString()}`);
  };

  const handleModerationAction = async (action: ModerateAction, ids?: string[], editData?: { id: string; bodyMd: string }) => {
    startTransition(async () => {
      try {
        if (action === "edit" && editData) {
          await performModerationAction({
            action: "edit",
            id: editData.id,
            bodyMd: editData.bodyMd,
          });
        } else {
          await performModerationAction({
            action,
            ids: ids || selectedIds,
          });
        }

        // Refresh the data by navigating to the same page
        router.refresh();
        setSelectedIds([]);
      } catch (error) {
        console.error("Moderation action failed:", error);
        alert("Action failed. Please try again.");
      }
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => 
      prev.length === data.comments.length 
        ? []
        : data.comments.map(c => c.id)
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ModerationFilters 
        filter={filter} 
        onFilterChange={handleFilterChange} 
      />

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.length} comment{selectedIds.length !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleModerationAction("approve")}
                disabled={isPending}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleModerationAction("spam")}
                disabled={isPending}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
              >
                Mark Spam
              </button>
              <button
                onClick={() => handleModerationAction("delete")}
                disabled={isPending}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {data.comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments found matching the current filters.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={selectedIds.length === data.comments.length && data.comments.length > 0}
                onChange={toggleSelectAll}
                className="rounded"
              />
              <span className="text-sm text-muted-foreground">
                Select all ({data.totalCount} total comments)
              </span>
            </div>
            
            {data.comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                isSelected={selectedIds.includes(comment.id)}
                onToggleSelection={() => toggleSelection(comment.id)}
                onModerationAction={handleModerationAction}
                isPending={isPending}
              />
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {data.totalCount > 0 && (
        <ModerationPagination
          currentPage={page}
          totalCount={data.totalCount}
          pageSize={20} // This should match MODERATION.PAGE-SIZE
          hasMore={data.hasMore}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

function ModerationFilters({ 
  filter, 
  onFilterChange 
}: { 
  filter: ModerationFilter; 
  onFilterChange: (filter: Partial<ModerationFilter>) => void;
}) {
  const [searchInput, setSearchInput] = useState(filter.search || "");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSearch = searchInput.trim();
    onFilterChange({ search: trimmedSearch || undefined });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search comments, authors, or posts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Search
            </button>
          </form>
        </div>
        
        <div className="flex gap-2">
          <select
            value={filter.status || ""}
            onChange={(e) => onFilterChange({ 
              status: e.target.value as any || undefined 
            })}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="spam">Spam</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function CommentCard({ 
  comment, 
  isSelected, 
  onToggleSelection, 
  onModerationAction,
  isPending 
}: {
  comment: ModerationComment;
  isSelected: boolean;
  onToggleSelection: () => void;
  onModerationAction: (action: ModerateAction, ids?: string[], editData?: { id: string; bodyMd: string }) => void;
  isPending: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.bodyMd || "");

  const handleEdit = () => {
    if (editText.trim() && editText !== comment.bodyMd) {
      onModerationAction("edit", undefined, { id: comment.id, bodyMd: editText.trim() });
      setIsEditing(false);
    }
  };

  const statusBadgeClass = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", 
    spam: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    deleted: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  }[comment.status] || "bg-gray-100 text-gray-800";

  return (
    <div className={`border rounded-lg p-4 ${isSelected ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20" : "bg-white dark:bg-gray-800"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          className="mt-1 rounded"
        />
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">
                {comment.author.name || comment.author.email || "Anonymous"}
              </span>
              <span>•</span>
              <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <a 
                href={`/${comment.postSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {comment.postTitle}
              </a>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass}`}>
              {comment.status}
            </span>
          </div>

          {/* Content */}
          <div className="mb-3">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full p-2 border rounded-md min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEdit}
                    disabled={isPending}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.bodyMd || "");
                    }}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className={`prose prose-sm max-w-none dark:prose-invert ${!isExpanded && comment.bodyHtml.length > 300 ? "line-clamp-3" : ""}`}
                dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
              />
            )}
            
            {!isEditing && comment.bodyHtml.length > 300 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>

          {/* Attachments */}
          {comment.attachments.length > 0 && (
            <div className="mb-3">
              <div className="flex gap-2 flex-wrap">
                {comment.attachments.map((attachment) => (
                  <div key={attachment.id} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {attachment.kind}: {attachment.url.split("/").pop()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onModerationAction("approve", [comment.id])}
              disabled={isPending || comment.status === "approved"}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => onModerationAction("spam", [comment.id])}
              disabled={isPending || comment.status === "spam"}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
            >
              Spam
            </button>
            <button
              onClick={() => onModerationAction("delete", [comment.id])}
              disabled={isPending || comment.status === "deleted"}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={() => setIsEditing(true)}
              disabled={isPending || isEditing}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModerationPagination({
  currentPage,
  totalCount,
  pageSize,
  hasMore,
  onPageChange,
}: {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalCount} comments
      </div>
      
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const page = Math.max(1, currentPage - 2) + i;
          if (page > totalPages) return null;
          
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 border rounded ${
                page === currentPage 
                  ? "bg-blue-600 text-white border-blue-600" 
                  : "hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          );
        })}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasMore}
          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}