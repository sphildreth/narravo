# Slice C — Nested Comments

- Server action `createComment` (in `lib/comments.ts`) enforces depth ≤4, sanitizes markdown via `sanitizeMarkdown`, and revalidates `post:{id}` / `comments:post:{id}` tags before redirecting back to the post.
- `listCommentsForPost(postId)` caches threaded data per post; post pages rebuild trees server-side and render reply forms while gating them behind session checks.
- Forms post directly to the server action (using `.bind` for post/parent context), keeping HTML simple while stubbing rate limiting for follow-up Slice H.
