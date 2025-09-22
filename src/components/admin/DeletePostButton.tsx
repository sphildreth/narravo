// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState, useTransition } from "react";
import { deletePostAction } from "@/app/actions/deletePost";
import { useRouter } from "next/navigation";

type DeletePostButtonProps = {
  postId: string;
  postTitle: string;
};

export default function DeletePostButton({ postId, postTitle }: DeletePostButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", postId);
        
        const result = await deletePostAction(formData);
        
        if (result.error) {
          setError(result.error);
          setShowConfirm(false);
        } else {
          // Redirect to home page after successful deletion
          router.push("/");
        }
      } catch (err) {
        console.error("Delete error:", err);
        setError("An unexpected error occurred");
        setShowConfirm(false);
      }
    });
  };

  if (showConfirm) {
    return (
      <div className="inline-flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <span className="text-sm text-red-800">
          Delete "{postTitle}"?
        </span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Deleting..." : "Yes, Delete"}
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
        className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
        title="Delete this post"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}