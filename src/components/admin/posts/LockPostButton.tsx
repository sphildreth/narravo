"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useTransition } from "react";
import { togglePostLock } from "@/app/(admin)/admin/posts/actions";

interface LockPostButtonProps {
  postId: string;
  isLocked: boolean;
}

export default function LockPostButton({ postId, isLocked }: LockPostButtonProps) {
  const [currentLockState, setCurrentLockState] = useState(isLocked);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggleLock = () => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await togglePostLock(postId);
        if (result.error) {
          setError(result.error);
        } else if (result.success) {
          setCurrentLockState(result.isLocked ?? !currentLockState);
        }
      } catch (err) {
        setError("Failed to toggle post lock");
      }
    });
  };

  return (
    <div>
      <button
        onClick={handleToggleLock}
        disabled={isPending}
        className="inline-flex items-center px-3 py-1 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {currentLockState ? (
            // Locked icon
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          ) : (
            // Unlocked icon
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          )}
        </svg>
        {isPending ? "Processing..." : (currentLockState ? "Unlock" : "Lock")}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}