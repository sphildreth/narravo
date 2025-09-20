# Reactions Feature (Slice D)

This document describes the reactions feature that allows users to react to posts and comments with emoji-based reactions.

## Overview

The reactions system allows authenticated users to:
- React to posts and comments with various emoji reactions
- Toggle reactions on/off (like/unlike)
- View reaction counts for posts and comments
- See their own reaction status

## Supported Reaction Types

- 👍 `like` - Like
- 👎 `dislike` - Dislike  
- ❤️ `heart` - Love
- 😂 `laugh` - Laugh
- 👍 `thumbsup` - Thumbs up
- 👎 `thumbsdown` - Thumbs down

## Database Schema

The reactions are stored in the `reactions` table with:
- `targetType` - Either "post" or "comment"
- `targetId` - UUID of the target post or comment
- `userId` - UUID of the reacting user
- `kind` - The reaction type (like, heart, etc.)
- Unique constraint on (targetType, targetId, userId, kind)

## API

### Server Actions

#### `toggleReactionAction(targetType, targetId, kind)`
- Toggles a reaction for the authenticated user
- Returns `{ added: boolean, error?: string }`
- Requires authentication

### Library Functions

#### `toggleReaction(targetType, targetId, userId, kind)`
- Core toggle logic with database operations
- Handles cache invalidation

#### `getReactionCounts(targetType, targetId)`
- Returns reaction counts for a target
- Format: `{ [kind]: count }`

#### `getUserReactions(targetType, targetId, userId)`
- Returns user's reactions for a target  
- Format: `{ [kind]: boolean }`

## Components

### `ReactionButtons`
- Client component for rendering reaction buttons
- Supports optimistic updates
- Props: `targetType`, `targetId`, `counts`, `userReactions`, `kinds[]`

## Usage

### In Post Pages
```tsx
import ReactionButtons from "@/components/reactions/ReactionButtons";

<ReactionButtons
  targetType="post"
  targetId={post.id}
  counts={post.reactions.counts}
  userReactions={post.reactions.userReactions}
  kinds={["like", "heart", "laugh"]}
/>
```

### In Comment Components
```tsx
<ReactionButtons
  targetType="comment"
  targetId={comment.id}
  counts={comment.reactions.counts}
  userReactions={comment.reactions.userReactions}
  kinds={["like", "heart"]}
/>
```

## Rate Limiting

Reactions are rate-limited via the `RATE.REACTIONS-PER-MINUTE` configuration (default: 20).

## Cache Invalidation

Reactions trigger cache invalidation:
- Post reactions: `post:{id}` and `home` tags
- Comment reactions: `post:{postId}` tag (found via comment lookup)

## Testing

Unit tests cover:
- Type definitions
- Reaction kind validation
- Target type validation

Integration tests would verify:
- Toggle functionality
- Unique constraint enforcement
- Count accuracy
- Cache invalidation

## Configuration

Required configuration key:
- `RATE.REACTIONS-PER-MINUTE` (integer, default: 20)