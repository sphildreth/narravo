import { db } from "./db";
import { reactions, posts, comments } from "../drizzle/schema";
import { and, eq, count, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export type TargetType = "post" | "comment";
export type ReactionKind = "like" | "dislike" | "heart" | "laugh" | "thumbsup" | "thumbsdown";

export interface ReactionCounts {
  [kind: string]: number;
}

export interface UserReactions {
  [kind: string]: boolean;
}

/**
 * Toggle a reaction for a user. If the reaction exists, remove it. If not, add it.
 * Enforces unique constraint (targetType, targetId, userId, kind).
 */
export async function toggleReaction(
  targetType: TargetType,
  targetId: string,
  userId: string,
  kind: ReactionKind
): Promise<{ added: boolean; error?: string }> {
  try {
    // Check if reaction already exists
    const existingReaction = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId),
          eq(reactions.userId, userId),
          eq(reactions.kind, kind)
        )
      )
      .limit(1);

    if (existingReaction.length > 0) {
      // Remove existing reaction
      await db
        .delete(reactions)
        .where(
          and(
            eq(reactions.targetType, targetType),
            eq(reactions.targetId, targetId),
            eq(reactions.userId, userId),
            eq(reactions.kind, kind)
          )
        );

      // Revalidate cache
      await revalidateCache(targetType, targetId);
      
      return { added: false };
    } else {
      // Add new reaction
      await db.insert(reactions).values({
        targetType,
        targetId,
        userId,
        kind,
      });

      // Revalidate cache
      await revalidateCache(targetType, targetId);
      
      return { added: true };
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return { added: false, error: "Failed to toggle reaction" };
  }
}

/**
 * Get reaction counts for a target (post or comment)
 */
export async function getReactionCounts(
  targetType: TargetType,
  targetId: string
): Promise<ReactionCounts> {
  try {
    const counts = await db
      .select({
        kind: reactions.kind,
        count: count(),
      })
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId)
        )
      )
      .groupBy(reactions.kind);

    const result: ReactionCounts = {};
    for (const { kind, count: c } of counts) {
      result[kind] = c;
    }
    return result;
  } catch (error) {
    console.error("Error getting reaction counts:", error);
    return {};
  }
}

/**
 * Get user's reactions for a target
 */
export async function getUserReactions(
  targetType: TargetType,
  targetId: string,
  userId: string
): Promise<UserReactions> {
  try {
    const userReactions = await db
      .select({ kind: reactions.kind })
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId),
          eq(reactions.userId, userId)
        )
      );

    const result: UserReactions = {};
    for (const { kind } of userReactions) {
      result[kind] = true;
    }
    return result;
  } catch (error) {
    console.error("Error getting user reactions:", error);
    return {};
  }
}

/**
 * Get reaction counts for multiple targets at once
 */
export async function getMultipleReactionCounts(
  targets: Array<{ targetType: TargetType; targetId: string }>
): Promise<Record<string, ReactionCounts>> {
  if (targets.length === 0) return {};

  try {
    // For simplicity, get all reactions and filter in memory
    // This is fine for MVP since we're dealing with small datasets
    const allResults = await Promise.all(
      targets.map(async ({ targetType, targetId }) => {
        const counts = await getReactionCounts(targetType, targetId);
        return { key: `${targetType}:${targetId}`, counts };
      })
    );

    const final: Record<string, ReactionCounts> = {};
    for (const { key, counts } of allResults) {
      final[key] = counts;
    }

    return final;
  } catch (error) {
    console.error("Error getting multiple reaction counts:", error);
    return {};
  }
}

/**
 * Revalidate cache after reaction changes
 */
async function revalidateCache(targetType: TargetType, targetId: string) {
  if (targetType === "post") {
    revalidateTag(`post:${targetId}`);
    revalidateTag("home");
  } else if (targetType === "comment") {
    // Find the post ID for this comment to revalidate the post page
    const comment = await db
      .select({ postId: comments.postId })
      .from(comments)
      .where(eq(comments.id, targetId))
      .limit(1);
    
    if (comment.length > 0 && comment[0]?.postId) {
      revalidateTag(`post:${comment[0].postId}`);
    }
  }
}