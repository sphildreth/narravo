"use server";
import { getCommentTreeForPost } from "@/lib/comments";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
export async function loadReplies(params: { postId: string; parentPath: string | null; already?: number; cursor?: string | null; topLevel?: boolean; }) {
  if (params.topLevel) {
    const config = new ConfigServiceImpl({ db });
    const topPage = await config.getNumber("COMMENTS.TOP-PAGE-SIZE");
    if (topPage == null) throw new Error("Missing required config: COMMENTS.TOP-PAGE-SIZE");
    const repliesPage = await config.getNumber("COMMENTS.REPLIES-PAGE-SIZE");
    if (repliesPage == null) throw new Error("Missing required config: COMMENTS.REPLIES-PAGE-SIZE");
    const r = await getCommentTreeForPost(params.postId, { cursor: params.cursor ?? null, limitTop: topPage, limitReplies: repliesPage });
    return { nodes: r.top, nextCursor: r.nextCursor };
  }
  return { nodes: [], nextCursor: null };
}
