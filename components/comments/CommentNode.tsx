"use client";
import Image from "next/image";
import ReactionButtons from "@/components/reactions/ReactionButtons";

export default function CommentNode({ node }: { node: any }) {
  const created = new Date(node.createdAt).toLocaleString();
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <header className="flex items-center gap-2 text-sm text-muted mb-1">
        {node.author?.image && (
          <Image src={node.author.image} alt="" width={20} height={20} className="rounded-full" />
        )}
        <span className="font-medium text-fg">{node.author?.name ?? "User"}</span>
        <span>•</span>
        <time dateTime={node.createdAt}>{created}</time>
      </header>
      <div className="prose" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />
      <div className="mt-2 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <button className="text-sm text-brand hover:underline">Reply</button>
          <a className="text-sm text-muted hover:underline" href={`#comment-${node.id}`}>Link</a>
        </div>
        {node.reactions && (
          <ReactionButtons
            targetType="comment"
            targetId={node.id}
            counts={node.reactions.counts}
            userReactions={node.reactions.userReactions}
            kinds={["like", "heart"]}
          />
        )}
      </div>
    </article>
  );
}
