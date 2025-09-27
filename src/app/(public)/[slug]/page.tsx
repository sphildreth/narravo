// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
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
import LockPostButton from "@/components/admin/posts/LockPostButton";
import UnpublishPostButton from "@/components/admin/posts/UnpublishPostButton";
import Link from "next/link";
import Prose from "@/components/Prose";
import { RenderTimeBadge } from "@/components/RenderTimeBadge";
import { RUMCollector } from "@/components/RUMCollector";
import { measureAsync, createServerTimingHeader } from "@/lib/performance";
import { formatDateSafe } from "@/lib/dateFormat";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  
  // For metadata generation, we need to check admin status to avoid leaking unpublished content
  const session = await getSession();
  const isAdmin = Boolean(session?.user?.isAdmin);
  
  const post = await getPostBySlug(resolvedParams.slug, isAdmin);
  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  // For unpublished posts viewed by non-admin users, don't generate detailed metadata
  if (!post.publishedAt && !isAdmin) {
    return {
      title: "Content Unavailable",
      description: "This content is no longer available.",
    };
  }

  const { title: siteName, url: siteUrl } = getSiteMetadata();
  return generatePostMetadata(post, siteUrl, siteName);
}

export default async function PostPage({ params }: Props) {
  const renderStart = performance.now();
  const resolvedParams = await params;
  
  // Measure config loading
  const { result: config, duration: configDuration } = await measureAsync(
    'config-load',
    async () => new ConfigServiceImpl({ db })
  );
  
  const sessionWindowMinutes = await config.getNumber("VIEW.SESSION-WINDOW-MINUTES") ?? 30;
  const showRenderBadge = await config.getBoolean("VIEW.PUBLIC-SHOW-RENDER-BADGE") ?? false;
  
  // Measure session loading
  const { result: session, duration: sessionDuration } = await measureAsync(
    'session-load',
    async () => getSession()
  );
  
  const userId = session?.user?.id || undefined;
  const isAdmin = Boolean(session?.user?.isAdmin);
  const canReact = Boolean(session?.user?.id);

  // Measure post loading (main data fetch)
  const { result: post, duration: postDuration } = await measureAsync(
    'post-load',
    async () => getPostBySlugWithReactions(resolvedParams.slug, userId, isAdmin)
  );
  
  if (!post) {
    // Check if this is an unpublished post that exists but isn't visible to non-admin users
    if (!isAdmin) {
      const adminPost = await getPostBySlug(resolvedParams.slug, true);
      if (adminPost && !adminPost.publishedAt) {
        // Post exists but is unpublished and user is not admin
        return (
          <main className="max-w-screen mx-auto px-6 my-7">
            <div className="max-w-2xl mx-auto text-center py-16">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-fg mb-2">Content Unavailable</h1>
                <p className="text-muted-foreground">
                  This post has been removed by the site administrator or is no longer available.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  If you believe this is an error, please contact the site administrator.
                </p>
                <div className="pt-4">
                  <Link 
                    href="/" 
                    className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Return to Home
                  </Link>
                </div>
              </div>
            </div>
          </main>
        );
      }
    }
    notFound();
  }
  
  // Measure navigation data loading
  const { result: [previousPost, nextPost], duration: navDuration } = await measureAsync(
    'navigation-load',
    async () => Promise.all([
      getPreviousPost(post.id),
      getNextPost(post.id),
    ])
  );
  
  // Use configured date format
  // Note: This is a Server Component; DateFormatProvider context is for client side.
  // For server rendering, read config directly with a safe default.
  const configForDate = new ConfigServiceImpl({ db });
  const df = (await configForDate.getString("VIEW.DATE-FORMAT")) ?? "MMMM d, yyyy";
  const date = formatDateSafe(post.publishedAt ?? null, df);

  const { title: siteName, url: siteUrl } = getSiteMetadata();
  const jsonLd = generatePostJsonLd(post, siteUrl, siteName);

  // Calculate total render time and set Server-Timing header
  const renderEnd = performance.now();
  const totalRenderTime = renderEnd - renderStart;
  const totalDbTime = configDuration + postDuration + navDuration;
  
  // Set Server-Timing header for performance monitoring
  const headersList = headers();
  const serverTimingHeader = createServerTimingHeader({
    srt: totalRenderTime,
    dbTime: totalDbTime,
    cacheStatus: 'MISS', // TODO: Determine actual cache status
  });

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
      <RUMCollector />
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
                            <LockPostButton postId={post.id} isLocked={!!(post as any).isLocked} />
                            {post.publishedAt && (
                              <UnpublishPostButton postId={post.id} isPublished={!!post.publishedAt} />
                            )}
                            <DeletePostButton postId={post.id} postTitle={post.title} />
                        </div>
                    </div>
                </div>
            )}
            {/* Featured Image Display - below admin actions as requested */}
            {post.featuredImageUrl && (
                <div className="border border-border rounded-xl bg-card shadow-soft overflow-hidden">
                    <img
                        src={post.featuredImageUrl}
                        alt={post.featuredImageAlt || post.title}
                        className="w-full h-auto object-cover"
                        loading="eager"
                        style={{ maxHeight: '500px' }}
                    />
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
                  {(post as any).isLocked ? "🔒" : ""}{post.title}
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
          
          {(post as any).isLocked ? (
            <div className="border border-border rounded-xl bg-card shadow-soft p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gray-600 font-medium">Comments are disabled</span>
              </div>
              <p className="text-gray-500 text-sm">This post is locked and no longer accepts comments.</p>
            </div>
          ) : (
            <CommentsSection postId={post.id} />
          )}
        </div>
      </main>
      <RenderTimeBadge serverMs={Math.round(totalRenderTime)} showBadge={showRenderBadge} />
    </>
  );
}
