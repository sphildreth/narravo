"use client";
import { useState, useTransition } from "react";
import { loadReplies } from "./actions";
import CommentNode from "./CommentNode";
export default function LoadMoreReplies({
  postId,
  parentPath,
  already = 0,
  cursor = null,
  topLevel = false,
}: {
  postId: string;
  parentPath: string | null;
  already?: number;
  cursor?: string | null;
  topLevel?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [nodes, setNodes] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(cursor ?? null);
  const [loaded, setLoaded] = useState(false);
  const onClick = () => {
    startTransition(async () => {
      const res = await loadReplies({ postId, parentPath, already, cursor: next, topLevel });
      setNodes((prev) => [...prev, ...res.nodes]);
      setNext(res.nextCursor);
      setLoaded(true);
    });
  };
  return (
    <div>
      {loaded && nodes.length > 0 && (
        <div className={topLevel ? "space-y-4" : "ml-4 pl-3 border-l border-border space-y-4"}>
          {nodes.map((n) => <CommentNode key={n.id} node={n} />)}
        </div>
      )}
      {next !== null && (
        <button className="text-sm text-brand" onClick={onClick} disabled={pending}>
          {pending ? "Loading…" : loaded ? "Load more" : topLevel ? "Load more comments" : "Load more replies"}
        </button>
      )}
    </div>
  );
}
