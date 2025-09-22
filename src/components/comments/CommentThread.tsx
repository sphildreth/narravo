// SPDX-License-Identifier: Apache-2.0
import CommentNode from "./CommentNode";
import LoadMoreReplies from "./LoadMoreReplies";
export default async function CommentThread({
  postId,
  nodes,
  childrenMap,
  nextCursor,
  limitReplies,
  canReact = false,
}: {
  postId: string;
  nodes: any[];
  childrenMap: Record<string, any[]>;
  nextCursor: string | null;
  limitReplies: number;
  canReact?: boolean;
}) {
  return (
    <div className="space-y-4">
      {nodes.map((n) => {
        const kids = childrenMap[n.path] ?? [];
        const hasMoreForParent =
          typeof n.childrenCount === "number" ? n.childrenCount > kids.length : false;
        return (
          <div key={n.id} id={`comment-${n.id}`}>
            <CommentNode node={n} canReact={canReact} />
            {kids.length > 0 && (
              <div className="ml-4 pl-3 border-l border-border space-y-4">
                {kids.map((c) => (
                  <CommentNode key={c.id} node={c} canReact={canReact} />
                ))}
                {hasMoreForParent && (
                  <LoadMoreReplies postId={postId} parentPath={n.path} already={kids.length} />
                )}
              </div>
            )}
          </div>
        );
      })}
      {nextCursor && (
        <div className="mt-4">
          <LoadMoreReplies postId={postId} parentPath={null} cursor={nextCursor} topLevel />
        </div>
      )}
    </div>
  );
}
