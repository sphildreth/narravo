// SPDX-License-Identifier: Apache-2.0
import { describe, test, expect } from "vitest";
import { type TargetType, type ReactionKind } from "@/lib/reactions";

describe("reactions types and constants", () => {
  test("reaction types are properly defined", () => {
    // Test that the types work as expected
    const targetType: TargetType = "post";
    const reactionKind: ReactionKind = "like";
    
    expect(targetType).toBe("post");
    expect(reactionKind).toBe("like");
    
    // Test other types
    const commentTarget: TargetType = "comment";
    const heartReaction: ReactionKind = "heart";
    
    expect(commentTarget).toBe("comment");
    expect(heartReaction).toBe("heart");
  });

  test("reaction kinds include expected values", () => {
    const validKinds: ReactionKind[] = ["like", "dislike", "heart", "laugh", "thumbsup", "thumbsdown"];
    
    // Test that all expected reaction kinds are valid
    validKinds.forEach(kind => {
      const reaction: ReactionKind = kind;
      expect(reaction).toBe(kind);
    });
  });

  test("target types include expected values", () => {
    const validTypes: TargetType[] = ["post", "comment"];
    
    // Test that all expected target types are valid
    validTypes.forEach(type => {
      const target: TargetType = type;
      expect(target).toBe(type);
    });
  });
});