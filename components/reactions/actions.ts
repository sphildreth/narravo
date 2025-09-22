"use server";
// SPDX-License-Identifier: Apache-2.0

import { toggleReaction, type TargetType, type ReactionKind } from "@/lib/reactions";
import { requireSession } from "@/lib/auth";
import { validateAntiAbuse } from "@/lib/rateLimit";
import { headers } from "next/headers";

export async function toggleReactionAction(
  targetType: TargetType,
  targetId: string,
  kind: ReactionKind,
  options?: {
    honeypot?: string;
    submitStartTime?: number;
  }
) {
  try {
    const session = await requireSession();
    
    if (!session.user?.id) {
      return { added: false, error: "User ID not found" };
    }

    // Anti-abuse validation including rate limiting
    const requestHeaders = headers();
    const antiAbuseResult = await validateAntiAbuse(session.user.id, "reaction", {
      honeypot: options?.honeypot ?? null,
      submitStartTime: options?.submitStartTime ?? null,
      headers: requestHeaders
    });

    if (!antiAbuseResult.valid) {
      return {
        added: false,
        error: antiAbuseResult.error,
        rateLimitInfo: antiAbuseResult.rateLimitInfo
      };
    }
    
    const result = await toggleReaction(targetType, targetId, session.user.id, kind);
    return result;
  } catch (error) {
    console.error("Error in toggleReactionAction:", error);
    return { added: false, error: "Authentication required" };
  }
}