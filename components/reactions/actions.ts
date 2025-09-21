"use server";
// SPDX-License-Identifier: Apache-2.0

import { toggleReaction, type TargetType, type ReactionKind } from "@/lib/reactions";
import { requireSession } from "@/lib/auth";

export async function toggleReactionAction(
  targetType: TargetType,
  targetId: string,
  kind: ReactionKind
) {
  try {
    const session = await requireSession();
    
    if (!session.user?.id) {
      return { added: false, error: "User ID not found" };
    }
    
    const result = await toggleReaction(targetType, targetId, session.user.id, kind);
    return result;
  } catch (error) {
    console.error("Error in toggleReactionAction:", error);
    return { added: false, error: "Authentication required" };
  }
}