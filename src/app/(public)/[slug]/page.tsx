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
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import DeletePostButton from "@/components/admin/DeletePostButton";
import Link from "next/link";
import Prose from "@/components/Prose";

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
  const config = new ConfigServiceImpl({ db });
  const sessionWindowMinutes = await config.getNumber("VIEW.SESSION-WINDOW-MINUTES") ?? 30;
  const session = await getSession();
  const userId = session?.user?.id || undefined;
  const isAdmin = Boolean(session?.user?.isAdmin);
  const canReact = Boolean(session?.user?.id);

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
      <main className="max-w-screen mx-auto px-6 my-7 grid gap-7">
  <ViewTracker postId={post.id} sessionWindowMinutes={sessionWindowMinutes} />
        <div className="order-1 md:order-2 grid gap-6">
            {isAdmin && (
                <div className="px-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-amber-800 font-medium">Admin Actions</span>
                        <div className="flex items-center gap-3">
                            <Link
                                href={`/admin/posts/${post.id}/edit`}
                                className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                            </Link>
                            <DeletePostButton postId={post.id} postTitle={post.title} />
                        </div>
                    </div>
                </div>
            )}
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
              </header>


              {/* Render post body with Prose to avoid max-width cap */}
              <Prose html={post.bodyHtml ?? ""} />

              {/* Tags and Category */}
              {(((post.tags?.length ?? 0) > 0) || Boolean(post.category)) && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex flex-wrap gap-6">
                    {post.category && (
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide block mb-1">Category</span>
                        <Link
                          href={`/categories/${post.category.slug}`}
                          className="inline-flex items-center text-brand hover:opacity-90 text-sm font-medium"
                        >
                          {post.category.name}
                        </Link>
                      </div>
                    )}
                    {(post.tags?.length ?? 0) > 0 && (
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide block mb-1">Tags</span>
                        <div className="flex flex-wrap gap-2">
                          {post.tags.map((tag: { id: string; slug: string; name: string }) => (
                            <Link
                              key={tag.id}
                              href={`/tags/${tag.slug}`}
                              className="inline-flex items-center px-2 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-sm hover:bg-accent/20 transition-colors"
                            >
                              #{tag.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Post reactions */}
              {canReact && post.reactions && (
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
