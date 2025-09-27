"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useTransition } from "react";
import { unpublishPost } from "@/app/(admin)/admin/posts/actions";

interface UnpublishPostButtonProps {
  postId: string;
  isPublished: boolean;
}

export default function UnpublishPostButton({ postId, isPublished }: UnpublishPostButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isUnpublished, setIsUnpublished] = useState(!isPublished);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleUnpublish = () => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await unpublishPost(postId);
        if (result.error) {
          setError(result.error);
          setShowConfirm(false);
        } else if (result.success) {
          setIsUnpublished(true);
          setShowConfirm(false);
        }
      } catch (err) {
        setError("Failed to unpublish post");
        setShowConfirm(false);
      }
    });
  };

  // Don't show the button if already unpublished
  if (isUnpublished) {
    return (
      <span className="inline-flex items-center px-3 py-1 text-sm text-gray-500 rounded">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.737 6.737m3.141 3.141l4.243 4.242m0 0L17.26 17.26m-3.019-3.019L18.484 5.484" />
        </svg>
        Unpublished
      </span>
    );
  }

  if (showConfirm) {
    return (
      <div className="inline-flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <span className="text-sm text-orange-800">
          Unpublish this post? It will no longer be visible to the public.
        </span>
        <button
          onClick={handleUnpublish}
          disabled={isPending}
          className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Unpublishing..." : "Yes, Unpublish"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          setError(null);
          setShowConfirm(true);
        }}
        disabled={isPending}
        className="inline-flex items-center px-3 py-1 text-sm text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.737 6.737m3.141 3.141l4.243 4.242m0 0L17.26 17.26m-3.019-3.019L18.484 5.484" />
        </svg>
        {isPending ? "Unpublishing..." : "Unpublish"}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}