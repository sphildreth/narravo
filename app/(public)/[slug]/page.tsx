import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ThemeToggle from "../../../components/ThemeToggle";
import { getPostBySlug } from "../../../lib/posts";
import { listCommentsForPost, createComment, CommentWithAuthor, MAX_COMMENT_DEPTH } from "../../../lib/comments";
import { getSession } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { posts } from "../../../drizzle/schema";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export const revalidate = false;

export async function generateStaticParams() {
  const rows = await db.select({ slug: posts.slug }).from(posts);
  return rows.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    return {
      title: "Post not found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  };
}

interface CommentTreeNode extends CommentWithAuthor {
  children: CommentTreeNode[];
}

const buildCommentTree = (items: CommentWithAuthor[]): CommentTreeNode[] => {
  const mapping = new Map<string, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  items.forEach((comment) => {
    mapping.set(comment.id, { ...comment, children: [] });
  });

  items.forEach((comment) => {
    const node = mapping.get(comment.id);
    if (!node) return;
    if (comment.parentId && mapping.has(comment.parentId)) {
      mapping.get(comment.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

function CommentForm({
  postId,
  parentId,
  slug,
  nextDepth,
  isReply,
}: {
  postId: string;
  parentId: string | null;
  slug: string;
  nextDepth: number;
  isReply?: boolean;
}) {
  return (
    <form
      action={createComment.bind(null, { postId, parentId, slug })}
      className="flex flex-col gap-2"
    >
      <label className="sr-only" htmlFor={`comment-body-${parentId ?? "root"}`}>
        {isReply ? "Reply" : "Comment"}
      </label>
      <textarea
        id={`comment-body-${parentId ?? "root"}`}
        name="bodyMd"
        required
        rows={3}
        maxLength={5000}
        placeholder={isReply ? "Write a reply..." : "Share your thoughts..."}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-fg shadow-soft focus:border-brand focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Depth {nextDepth} of {MAX_COMMENT_DEPTH}
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast shadow-soft transition-colors hover:bg-brand/90"
        >
          {isReply ? "Reply" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function CommentNode({
  node,
  postId,
  slug,
  sessionUserId,
}: {
  node: CommentTreeNode;
  postId: string;
  slug: string;
  sessionUserId: string | null;
}) {
  const canReply = node.depth + 1 < MAX_COMMENT_DEPTH;

  return (
    <li id={`comment-${node.id}`} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-fg">{node.author.name ?? "Anon"}</span>
          <span className="text-xs text-muted">{node.createdAt ? DATE_FORMATTER.format(node.createdAt) : ""}</span>
        </div>
      </div>
      <div className="prose prose-invert text-sm text-fg" dangerouslySetInnerHTML={{ __html: node.bodyHtml }} />
      {sessionUserId ? (
        canReply ? (
          <CommentForm postId={postId} parentId={node.id} slug={slug} nextDepth={node.depth + 1} isReply />
        ) : (
          <p className="text-xs text-muted">Maximum reply depth reached.</p>
        )
      ) : null}
      {node.children.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
          {node.children.map((child) => (
            <CommentNode key={child.id} node={child} postId={postId} slug={slug} sessionUserId={sessionUserId} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    notFound();
  }

  const [session, commentList] = await Promise.all([getSession(), listCommentsForPost(post.id)]);
  const commentTree = buildCommentTree(commentList);
  const themeCookie = cookies().get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";
  const publishedAt = post.publishedAt ?? post.createdAt;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-sm text-muted hover:text-brand hover:underline">
            ← Back to posts
          </Link>
          <h1 className="text-3xl font-semibold text-fg">{post.title}</h1>
          {publishedAt ? (
            <time dateTime={publishedAt.toISOString()} className="text-xs uppercase tracking-wide text-muted">
              {DATE_FORMATTER.format(publishedAt)}
            </time>
          ) : null}
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </header>

      <article className="prose prose-invert max-w-none text-fg" dangerouslySetInnerHTML={{ __html: post.html }} />

      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">Comments</h2>
          <span className="text-xs text-muted">{commentList.length} total</span>
        </header>

        {session ? (
          <CommentForm postId={post.id} parentId={null} slug={post.slug} nextDepth={1} />
        ) : (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted">
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>{" "}
            to join the discussion.
          </p>
        )}

        {commentTree.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {commentTree.map((node) => (
              <CommentNode
                key={node.id}
                node={node}
                postId={post.id}
                slug={post.slug}
                sessionUserId={session?.user?.id ?? null}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No comments yet.</p>
        )}
      </section>
    </main>
  );
}
