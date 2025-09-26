"use client";
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState, useTransition } from "react";
import { toggleReactionAction } from "./actions";
import type { TargetType, ReactionKind, ReactionCounts, UserReactions } from "@/lib/reactions";

// Reaction button mappings
const REACTION_EMOJIS: Record<ReactionKind, string> = {
  like: "👍",
  dislike: "👎", 
  heart: "❤️",
  laugh: "😂",
  thumbsup: "👍",
  thumbsdown: "👎",
};

const REACTION_LABELS: Record<ReactionKind, string> = {
  like: "Like",
  dislike: "Dislike",
  heart: "Love",
  laugh: "Laugh", 
  thumbsup: "Thumbs up",
  thumbsdown: "Thumbs down",
};

interface ReactionButtonsProps {
  targetType: TargetType;
  targetId: string;
  counts: ReactionCounts;
  userReactions: UserReactions;
  kinds?: ReactionKind[];
}

export default function ReactionButtons({
  targetType,
  targetId,
  counts,
  userReactions,
  kinds = ["like", "heart", "laugh"],
}: ReactionButtonsProps) {
  const [localCounts, setLocalCounts] = useState(counts);
  const [localUserReactions, setLocalUserReactions] = useState(userReactions);
  const [isPending, startTransition] = useTransition();
  // Track when the component mounted to satisfy anti-abuse minimum submit time
  const submitStartRef = useRef<number>(Date.now());

  const handleToggle = (kind: ReactionKind) => {
    if (isPending) return;

    // Optimistic update
    const wasActive = localUserReactions[kind] || false;
    const newCounts = { ...localCounts };
    const newUserReactions = { ...localUserReactions };

    if (wasActive) {
      // Removing reaction
      newCounts[kind] = Math.max(0, (newCounts[kind] || 0) - 1);
      newUserReactions[kind] = false;
    } else {
      // Adding reaction
      newCounts[kind] = (newCounts[kind] || 0) + 1;
      newUserReactions[kind] = true;
    }

    setLocalCounts(newCounts);
    setLocalUserReactions(newUserReactions);

    // Server action
    startTransition(async () => {
      try {
        const result = await toggleReactionAction(targetType, targetId, kind, {
          submitStartTime: submitStartRef.current,
        });
        if (result.error) {
          // Revert optimistic update on error
          setLocalCounts(counts);
          setLocalUserReactions(userReactions);
          console.error("Failed to toggle reaction:", result.error);
        }
      } catch (error) {
        // Revert optimistic update on error
        setLocalCounts(counts);
        setLocalUserReactions(userReactions);
        console.error("Failed to toggle reaction:", error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {kinds.map((kind) => {
        const count = localCounts[kind] || 0;
        const isActive = localUserReactions[kind] || false;
        
        return (
          <button
            key={kind}
            onClick={() => handleToggle(kind)}
            disabled={isPending}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors
              ${isActive
                ? "bg-brand/20 text-brand border border-brand/30"
                : "bg-muted/50 text-muted border border-border hover:bg-muted/80"
              }
              ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            title={`${REACTION_LABELS[kind]} (${count})`}
          >
            <span className="text-base leading-none">
              {REACTION_EMOJIS[kind]}
            </span>
            {count > 0 && (
              <span className="text-xs font-medium">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}