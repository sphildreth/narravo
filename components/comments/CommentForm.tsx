"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CommentUpload from "@/components/CommentUpload";
import { createComment } from "./actions";

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

interface UploadedFile {
  key: string;
  url: string;
  kind: "image" | "video";
  mimeType: string;
  size: number;
  name: string;
}

export default function CommentForm({ 
  postId, 
  parentId = null, 
  onSuccess, 
  onCancel,
  placeholder = "Write your comment..." 
}: CommentFormProps) {
  const [bodyMd, setBodyMd] = useState("");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bodyMd.trim() && attachments.length === 0) {
      setError("Please add some content or attachments");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createComment({
        postId,
        parentId,
        bodyMd: bodyMd.trim(),
        attachments,
      });

      if (result.success) {
        setBodyMd("");
        setAttachments([]);
        onSuccess?.();
        router.refresh(); // Refresh to show the new comment
      } else {
        setError(result.error || "Failed to create comment");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Comment submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setBodyMd("");
    setAttachments([]);
    setError(null);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Text Area */}
      <div>
        <textarea
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          disabled={isSubmitting}
        />
      </div>

      {/* File Upload */}
      <CommentUpload
        onFilesChange={setAttachments}
        maxFiles={3}
        disabled={isSubmitting}
      />

      {/* Error Message */}
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || (!bodyMd.trim() && attachments.length === 0)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Posting..." : "Post Comment"}
        </button>
        
        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Markdown Help */}
      <div className="text-xs text-gray-500">
        Supports <strong>**bold**</strong>, <em>*italic*</em>, and [links](url). 
        Comments are moderated and may take time to appear.
      </div>
    </form>
  );
}