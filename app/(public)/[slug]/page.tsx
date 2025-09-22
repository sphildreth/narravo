// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getPostBySlugWithReactions, getPreviousPost, getNextPost } from "@/lib/posts";
import { getSession } from "@/lib/auth";
import { getSiteMetadata } from "@/lib/rss";
import { generatePostMetadata, generatePostJsonLd } from "@/lib/seo";
import CommentsSection from "@/components/comments/CommentsSection";
import ReactionButtons from "@/components/reactions/ReactionButtons";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import Link from "next/link";

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const { title: siteName, url: siteUrl } = getSiteMetadata();
  return generatePostMetadata(post, siteUrl, siteName);
}

export default async function PostPage({ params }: Props) {
  const session = await getSession();
  const userId = session?.user?.id || undefined;

  const post = await getPostBySlugWithReactions(params.slug, userId);
  if (!post) {
    notFound();
  }
  
  // Get previous and next posts
  const [previousPost, nextPost] = await Promise.all([
    getPreviousPost(post.id),
    getNextPost(post.id),
  ]);
  
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString()
    : "";

  const { title: siteName, url: siteUrl } = getSiteMetadata();
  const jsonLd = generatePostJsonLd(post, siteUrl, siteName);

  // Format view count for display
  const formatViewCount = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <main className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
        <ViewTracker postId={post.id} />
        <div className="order-1 md:order-2 grid gap-6">
          <article className="article border border-border rounded-xl bg-card shadow-soft">
            <div className="article__body p-6">
              <header className="mb-3">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{date}</span>
                  {post.viewsTotal !== undefined && post.viewsTotal > 0 && (
                    <span>• {formatViewCount(post.viewsTotal)} views</span>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mt-1">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="mt-2 text-gray-700">{post.excerpt}</p>
                )}
              </header>
              <div
                className="prose"
                dangerouslySetInnerHTML={{ __html: post.bodyHtml ?? "" }}
              />

              {/* Post reactions */}
              {post.reactions && (
                <div className="mt-4 pt-4 border-t border-border">
                  <ReactionButtons
                    targetType="post"
                    targetId={post.id}
                    counts={post.reactions.counts}
                    userReactions={post.reactions.userReactions}
                    kinds={["like", "heart", "laugh"]}
                  />
                </div>
              )}
            </div>
          </article>
          
          {/* Previous/Next Navigation */}
          {(previousPost || nextPost) && (
            <nav className="border border-border rounded-xl bg-card shadow-soft p-6" aria-label="Post navigation">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  {previousPost && (
                    <Link 
                      href={`/${previousPost.slug}`}
                      className="group block text-left"
                    >
                      <div className="text-xs text-muted uppercase tracking-wide mb-1">Previous</div>
                      <div className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                        {previousPost.title}
                      </div>
                    </Link>
                  )}
                </div>
                <div className="flex-1 text-right">
                  {nextPost && (
                    <Link 
                      href={`/${nextPost.slug}`}
                      className="group block text-right"
                    >
                      <div className="text-xs text-muted uppercase tracking-wide mb-1">Next</div>
                      <div className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                        {nextPost.title}
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </nav>
          )}
          
          <CommentsSection postId={post.id} />
        </div>
      </main>
    </>
  );
}
