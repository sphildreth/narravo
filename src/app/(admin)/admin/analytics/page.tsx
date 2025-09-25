// SPDX-License-Identifier: Apache-2.0
import { listPosts } from "@/lib/posts";
import { getPostSparkline, getPostViewCounts } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import Sparkline from "@/components/analytics/Sparkline";
import Link from "next/link";
import { formatDateSafe } from "@/lib/dateFormat";

export default async function AnalyticsPage() {
  const config = new ConfigServiceImpl({ db });
  const sparklineDays = await config.getNumber("VIEW.ADMIN-SPARKLINE-DAYS") ?? 30;
  const dateFormat = (await config.getString("VIEW.DATE-FORMAT")) ?? "MMMM d, yyyy";

  // Get recent posts
  const { items: posts } = await listPosts({ limit: 20, includeViews: true });
  
  // Get view counts and sparkline data for each post
  const postIds = posts.map(p => p.id);
  const viewCounts = postIds.length > 0 ? await getPostViewCounts(postIds) : new Map();
  
  // Get sparkline data for each post
  const sparklinePromises = posts.map(async (post) => {
    const sparklineData = await getPostSparkline(post.id, sparklineDays);
    return { postId: post.id, data: sparklineData };
  });
  
  const sparklines = await Promise.all(sparklinePromises);
  const sparklineMap = new Map(sparklines.map(s => [s.postId, s.data]));

  // Format view count for display
  const formatViewCount = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  // Combine data
  const postsWithAnalytics = posts.map(post => {
    const counts = viewCounts.get(post.id);
    const sparklineData = sparklineMap.get(post.id) || [];
    
    return {
      ...post,
      viewsTotal: counts?.totalViews ?? post.viewsTotal ?? 0,
      viewsLastNDays: counts?.viewsLastNDays ?? 0,
      sparklineData,
    };
  });

  // Sort by total views descending
  postsWithAnalytics.sort((a, b) => (b.viewsTotal || 0) - (a.viewsTotal || 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Analytics</h1>
        <p className="text-muted mt-1">Post performance over the last {sparklineDays} days</p>
      </div>

      <div className="border border-border rounded-xl bg-card shadow-soft">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Post Performance</h2>
        </div>
        
        <div className="divide-y divide-border">
          {postsWithAnalytics.map((post) => (
            <div key={post.id} className="p-6 hover:bg-muted/5 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-fg truncate">
                    <Link 
                      href={`/${post.slug}`}
                      className="hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                    <span>{formatViewCount(post.viewsTotal || 0)} total views</span>
                    {post.viewsLastNDays > 0 && (
                      <span>• {formatViewCount(post.viewsLastNDays)} recent</span>
                    )}
                    {post.publishedAt && (
                      <span>• {formatDateSafe(post.publishedAt, dateFormat)}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-fg">
                      {formatViewCount(post.viewsTotal || 0)}
                    </div>
                    <div className="text-xs text-muted">views</div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <Sparkline 
                      data={post.sparklineData} 
                      width={120} 
                      height={32}
                      className="text-primary"
                    />
                    <div className="text-xs text-muted">
                      {sparklineDays} days
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {postsWithAnalytics.length === 0 && (
            <div className="p-12 text-center text-muted">
              <p>No posts found</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-border rounded-xl bg-card shadow-soft p-6">
          <h3 className="font-semibold text-fg mb-2">Total Posts</h3>
          <div className="text-2xl font-bold text-primary">
            {postsWithAnalytics.length}
          </div>
        </div>
        
        <div className="border border-border rounded-xl bg-card shadow-soft p-6">
          <h3 className="font-semibold text-fg mb-2">Total Views</h3>
          <div className="text-2xl font-bold text-primary">
            {formatViewCount(
              postsWithAnalytics.reduce((sum, post) => sum + (post.viewsTotal || 0), 0)
            )}
          </div>
        </div>
        
        <div className="border border-border rounded-xl bg-card shadow-soft p-6">
          <h3 className="font-semibold text-fg mb-2">Recent Views</h3>
          <div className="text-2xl font-bold text-primary">
            {formatViewCount(
              postsWithAnalytics.reduce((sum, post) => sum + (post.viewsLastNDays || 0), 0)
            )}
          </div>
          <div className="text-xs text-muted mt-1">Last 7 days</div>
        </div>
      </div>
    </div>
  );
}