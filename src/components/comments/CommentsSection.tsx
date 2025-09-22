// SPDX-License-Identifier: Apache-2.0
import { Suspense } from "react";
import { countApprovedComments, getCommentTreeForPost } from "@/lib/comments";
import { getSession } from "@/lib/auth";
import CommentThread from "./CommentThread";
import CommentForm from "./CommentForm";

export default async function CommentsSection({ postId }: { postId: string }) {
  const session = await getSession();
  const userId = session?.user?.id || undefined;
  const canReact = Boolean(session?.user?.id);

  const [count, initial] = await Promise.all([
    countApprovedComments(postId),
    getCommentTreeForPost(postId, { limitTop: 10, limitReplies: 3, userId }),
  ]);
  
  return (
    <section id="comments" className="mt-12">
      <h2 className="text-lg font-semibold mb-6">{count} Comments</h2>
      
      {/* Comment Form */}
      {session ? (
        <div className="mb-8 p-4 border border-border rounded-lg bg-card">
          <CommentForm postId={postId} />
        </div>
      ) : (
        <div className="mb-8 p-4 border border-border rounded-lg bg-card text-center">
          <p className="text-muted mb-2">Sign in to join the conversation</p>
          <a
            href="/login"
            className="text-brand hover:opacity-90 font-medium"
          >
            Sign in
          </a>
        </div>
      )}
      
      {/* Comments */}
      {count === 0 ? (
        <p className="text-muted">Be the first to comment.</p>
      ) : (
        <Suspense fallback={<div className="animate-pulse h-24 rounded-xl bg-card" />}>
          <CommentThread
            postId={postId}
            nodes={initial.top}
            childrenMap={initial.children}
            nextCursor={initial.nextCursor}
            limitReplies={3}
            canReact={canReact}
          />
        </Suspense>
      )}
    </section>
  );
}
