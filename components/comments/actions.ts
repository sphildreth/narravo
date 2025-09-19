"use server";
import { getCommentTreeForPost } from "@/lib/comments";
export async function loadReplies(params: { postId: string; parentPath: string | null; already?: number; cursor?: string | null; topLevel?: boolean; }) {
  if (params.topLevel) {
    const r = await getCommentTreeForPost(params.postId, { cursor: params.cursor ?? null, limitTop: 10, limitReplies: 0 });
    return { nodes: r.top, nextCursor: r.nextCursor };
  }
  return { nodes: [], nextCursor: null };
}
