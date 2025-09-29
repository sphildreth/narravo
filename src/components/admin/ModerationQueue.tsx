"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { performModerationAction } from "@/app/(admin)/admin/moderation/actions";
import type { ModerationResult, ModerationComment, ModerationFilter } from "@/lib/moderation";
import type { ModerateAction } from "@/lib/adminModeration";
import { useDateFormat } from "@/lib/dateFormat.client";
import { formatDateSafe } from "@/lib/dateFormat";
import logger from '@/lib/logger';

interface ModerationQueueProps {
  initialData: ModerationResult;
  filter: ModerationFilter;
  page: number;
}

export default function ModerationQueue({ initialData, filter, page }: ModerationQueueProps) {
  const data = initialData;
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
        logger.error("Moderation action failed:", error);
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
        <div className="border border-brand/30 rounded-lg p-4 bg-brand/10">
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
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to permanently delete ${selectedIds.length} comment(s)? This action cannot be undone and will also remove all attachments.`)) {
                    handleModerationAction("hardDelete");
                  }
                }}
                disabled={isPending}
                className="px-3 py-1 bg-red-800 text-white rounded text-sm hover:bg-red-900 disabled:opacity-50"
                title="Permanently delete selected comments"
              >
                Hard Delete
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
    <div className="border border-border rounded-xl bg-card shadow-soft p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search comments, authors, or posts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-brand text-brand-contrast text-sm font-medium hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>
        
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">
            Status
          </label>
          <select
            id="status"
            value={filter.status || ""}
            onChange={(e) => onFilterChange({ 
              status: (e.target.value as any) || undefined
            })}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="spam">Spam</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        <div>
          <label htmlFor="dateFrom" className="block text-sm font-medium mb-1">
            Date Range
          </label>
          <input
            id="dateFrom"
            type="date"
            value={(filter as any).dateFrom || ""}
            onChange={(e) => onFilterChange({ dateFrom: e.target.value || undefined } as any)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          />
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
  const fmt = useDateFormat();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.bodyMd || "");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const handleEdit = () => {
    if (editText.trim() && editText !== comment.bodyMd) {
      onModerationAction("edit", undefined, { id: comment.id, bodyMd: editText.trim() });
      setIsEditing(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;

    try {
      const formData = new FormData();
      formData.append("postId", comment.postId);
      formData.append("parentId", comment.id);
      formData.append("bodyMd", replyText.trim());

      // Import the action dynamically to avoid server action issues in client component
      const { createAdminReply } = await import("@/app/(admin)/admin/moderation/actions");
      const result = await createAdminReply(formData);

      if (result.success) {
        setReplyText("");
        setShowReplyForm(false);
        // Refresh the page to show the new reply
        window.location.reload();
      } else {
        alert(result.error || "Failed to create reply");
      }
    } catch (error) {
      logger.error("Error creating reply:", error);
      alert("Failed to create reply");
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to remove this attachment?")) return;

    try {
      const { removeCommentAttachment } = await import("@/app/(admin)/admin/moderation/actions");
      const result = await removeCommentAttachment(attachmentId);

      if (result.success) {
        // Refresh the page to update the attachments list
        window.location.reload();
      } else {
        alert(result.error || "Failed to remove attachment");
      }
    } catch (error) {
      logger.error("Error removing attachment:", error);
      alert("Failed to remove attachment");
    }
  };

  const handleHardDelete = () => {
    if (!confirm("Are you sure you want to permanently delete this comment? This action cannot be undone and will also remove all attachments.")) {
      return;
    }

    onModerationAction("hardDelete", [comment.id]);
  };

  const statusBadgeClass = {
    pending: "border border-brand/30 bg-brand/10 text-brand",
    approved: "border border-accent/30 bg-accent/10 text-accent",
    spam: "border border-red-600/30 bg-red-600/10 text-red-700",
    deleted: "border border-border bg-bg text-muted",
  }[comment.status] || "border border-border bg-bg text-muted";

  return (
    <div className={`border border-border rounded-lg p-4 ${isSelected ? "ring-2 ring-brand bg-brand/10" : "bg-card"}`}>
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
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="font-medium">
                {comment.author.name || comment.author.email || "Anonymous"}
              </span>
              <span>•</span>
              <span>{formatDateSafe(comment.createdAt, fmt)}</span>
              <span>•</span>
              <a 
                href={`/${comment.postSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                {comment.postTitle}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass}`}>
                {comment.status}
              </span>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-brand hover:underline"
              >
                {showDetails ? "Hide Details" : "Show Details"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="mb-3">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full p-2 rounded-md min-h-[100px] border border-border bg-bg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEdit}
                    disabled={isPending}
                    className="px-3 py-1 bg-brand text-brand-contrast rounded text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.bodyMd || "");
                    }}
                    className="px-3 py-1 bg-card text-fg border border-border rounded text-sm hover:bg-bg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className={`prose prose-sm max-w-none ${!isExpanded && comment.bodyHtml.length > 300 ? "line-clamp-3" : ""}`}
                dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
              />
            )}
            
            {!isEditing && comment.bodyHtml.length > 300 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-brand hover:underline"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>

          {/* Attachments */}
          {comment.attachments.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium mb-2">Attachments:</h4>
              <div className="space-y-2">
                {comment.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between bg-bg border border-border p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-1 bg-card border border-border rounded">
                        {attachment.kind}
                      </span>
                      <span className="text-sm truncate">{attachment.url.split("/").pop()}</span>
                      {attachment.posterUrl && (
                        <span className="text-xs text-muted-foreground">(with poster)</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="text-xs px-2 py-1 border border-red-600/30 bg-red-600/10 text-red-700 rounded hover:bg-red-600/20"
                      title="Remove attachment"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Reply Form */}
          {showReplyForm && (
            <div className="mb-3 p-3 rounded-md bg-brand/10">
              <h4 className="text-sm font-medium mb-2">Reply as Admin:</h4>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your admin reply..."
                className="w-full p-2 rounded-md min-h-[80px] border border-border bg-bg"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || isPending}
                  className="px-3 py-1 bg-brand text-brand-contrast rounded text-sm hover:opacity-90 disabled:opacity-50"
                >
                  Post Reply
                </button>
                <button
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText("");
                  }}
                  className="px-3 py-1 bg-card text-fg border border-border rounded text-sm hover:bg-bg"
                >
                  Cancel
                </button>
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
              className="px-3 py-1 bg-brand text-brand-contrast rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              disabled={isPending}
              className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              Reply
            </button>
            <button
              onClick={handleHardDelete}
              disabled={isPending}
              className="px-3 py-1 bg-red-800 text-white rounded text-sm hover:bg-red-900 disabled:opacity-50"
              title="Permanently delete comment and all attachments"
            >
              Hard Delete
            </button>
          </div>

          {/* Additional Details (when expanded) */}
          {showDetails && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Comment ID:</span> <code className="text-xs">{comment.id}</code>
                </div>
                <div>
                  <span className="font-medium">Author Email:</span> {comment.author.email || "—"}
                </div>
                <div>
                  <span className="font-medium">User ID:</span> <code className="text-xs">{comment.userId || "—"}</code>
                </div>
                <div>
                  <span className="font-medium">Created:</span> {new Date(comment.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
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
    <div className="flex items-center justify-between border-t border-border pt-4">
      <div className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalCount} comments
      </div>
      
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 border border-border rounded bg-card hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
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
              className={`px-3 py-1 border border-border rounded ${
                page === currentPage 
                  ? "bg-brand text-brand-contrast border-brand" 
                  : "bg-card hover:bg-bg"
              }`}
            >
              {page}
            </button>
          );
        })}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasMore}
          className="px-3 py-1 border border-border rounded bg-card hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}