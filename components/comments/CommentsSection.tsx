import { Suspense } from "react";
import { countApprovedComments, getCommentTreeForPost } from "@/lib/comments";
import { getSession } from "@/lib/auth";
import CommentThread from "./CommentThread";
import CommentForm from "./CommentForm";

export default async function CommentsSection({ postId }: { postId: string }) {
  const session = await getSession();
  const userId = session?.user?.id || undefined;
  
  const [count, initial] = await Promise.all([
    countApprovedComments(postId),
    getCommentTreeForPost(postId, { limitTop: 10, limitReplies: 3, userId }),
  ]);
  
  return (
    <section id="comments" className="mt-12">
      <h2 className="text-lg font-semibold mb-6">{count} Comments</h2>
      
      {/* Comment Form */}
      {session ? (
        <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <CommentForm postId={postId} />
        </div>
      ) : (
        <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50 text-center">
          <p className="text-gray-600 mb-2">Sign in to join the conversation</p>
          <a 
            href="/login" 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Sign in
          </a>
        </div>
      )}
      
      {/* Comments */}
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
