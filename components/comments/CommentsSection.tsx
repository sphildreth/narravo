import { Suspense } from "react";
import { countApprovedComments, getCommentTreeForPost } from "@/lib/comments";
import CommentThread from "./CommentThread";
export default async function CommentsSection({ postId }: { postId: string }) {
  const [count, initial] = await Promise.all([
    countApprovedComments(postId),
    getCommentTreeForPost(postId, { limitTop: 10, limitReplies: 3 }),
  ]);
  return (
    <section id="comments" className="mt-12">
      <h2 className="text-lg font-semibold mb-2">{count} Comments</h2>
      {count === 0 ? (
        <p className="text-muted">Be the first to comment.</p>
      ) : (
        <Suspense fallback={<div className="animate-pulse h-24 rounded-xl bg-gray-100" />}>
          <CommentThread
            postId={postId}
            nodes={initial.top}
            childrenMap={initial.children}
            nextCursor={initial.nextCursor}
            limitReplies={3}
          />
        </Suspense>
      )}
    </section>
  );
}
