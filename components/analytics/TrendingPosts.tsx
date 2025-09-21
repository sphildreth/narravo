// SPDX-License-Identifier: Apache-2.0
import { getTrendingPosts } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { unstable_cache as cache } from "next/cache";
import Link from "next/link";

export default async function TrendingPosts() {
  const config = new ConfigServiceImpl({ db });
  const trendingDays = await config.getNumber("VIEW.TRENDING-DAYS") ?? 7;
  const feedCount = await config.getNumber("FEED.LATEST-COUNT") ?? 5;
  const revalidateSeconds = await config.getNumber("VIEW.REVALIDATE-SECONDS") ?? 60;

  const getTrending = cache(
    async () => getTrendingPosts({ days: trendingDays, limit: Math.min(feedCount, 5) }),
    ["trending", `days:${trendingDays}`, `limit:${feedCount}`],
    { 
      revalidate: revalidateSeconds,
      tags: ["analytics:trending"]
    }
  );

  const trendingPosts = await getTrending();

  if (trendingPosts.length === 0) {
    return null; // Don't show section if no trending posts
  }

  // Format view count for display
  const formatViewCount = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  return (
    <section className="border border-border rounded-xl bg-card shadow-soft p-6">
      <h2 className="text-lg font-bold text-fg mb-4">
        🔥 Trending This Week
      </h2>
      <div className="space-y-4">
        {trendingPosts.map((post, index) => (
          <article key={post.id} className="group">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-snug">
                  <Link 
                    href={`/${post.slug}`} 
                    className="text-fg no-underline hover:underline"
                  >
                    {post.title}
                  </Link>
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                  {post.viewsLastNDays !== undefined && post.viewsLastNDays > 0 && (
                    <span>{formatViewCount(post.viewsLastNDays)} views</span>
                  )}
                  {post.totalViews && post.totalViews > 0 && (
                    <span>• {formatViewCount(post.totalViews)} total</span>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}