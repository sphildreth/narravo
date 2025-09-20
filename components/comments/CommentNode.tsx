"use client";
import Image from "next/image";
import ReactionButtons from "@/components/reactions/ReactionButtons";

interface CommentAttachment {
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
  mime?: string | null;
}

interface CommentNodeProps {
  node: {
    id: string;
    bodyHtml: string;
    createdAt: string;
    author?: {
      name?: string | null;
      image?: string | null;
    } | null;
    reactions?: {
      counts: Record<string, number>;
      userReactions: Record<string, boolean>;
    };
    attachments?: CommentAttachment[];
  };
}

export default function CommentNode({ node }: CommentNodeProps) {
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
      
      {/* Attachments */}
      {node.attachments && node.attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {node.attachments.map((attachment) => (
            <div key={attachment.id} className="overflow-hidden rounded-lg border border-gray-200">
              {attachment.kind === "image" ? (
                <img
                  src={attachment.url}
                  alt="Comment attachment"
                  className="max-w-full h-auto max-h-96 object-contain"
                />
              ) : (
                <video
                  controls
                  poster={attachment.posterUrl || undefined}
                  className="max-w-full h-auto max-h-96"
                  preload="metadata"
                >
                  <source src={attachment.url} type={attachment.mime || "video/mp4"} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          ))}
        </div>
      )}
      
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
