import CommentNode from "./CommentNode";
import LoadMoreReplies from "./LoadMoreReplies";
export default async function CommentThread({
  postId,
  nodes,
  childrenMap,
  nextCursor,
  limitReplies,
}: {
  postId: string;
  nodes: any[];
  childrenMap: Record<string, any[]>;
  nextCursor: string | null;
  limitReplies: number;
}) {
  return (
    <div className="space-y-4">
      {nodes.map((n) => {
        const kids = childrenMap[n.path] ?? [];
        const hasMoreForParent =
          typeof n.childrenCount === "number" ? n.childrenCount > kids.length : false;
        return (
          <div key={n.id} id={`comment-${n.id}`}>
            <CommentNode node={n} />
            {kids.length > 0 && (
              <div className="ml-4 pl-3 border-l border-border space-y-4">
                {kids.map((c) => (
                  <CommentNode key={c.id} node={c} />
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
