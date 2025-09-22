// SPDX-License-Identifier: Apache-2.0
import Navbar from "@/components/Navbar";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import LoadMore from "@/components/LoadMore";
import ProseExample from "@/components/Prose";
import TrendingPosts from "@/components/analytics/TrendingPosts";
import { listPosts } from "@/lib/posts";
import { getPostViewCounts } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { unstable_cache as cache } from "next/cache";

export default async function Page() {
  const config = new ConfigServiceImpl({ db });
  const revalidateSeconds = await config.getNumber("PUBLIC.HOME.REVALIDATE-SECONDS");
  if (revalidateSeconds == null) throw new Error("Missing required config: PUBLIC.HOME.REVALIDATE-SECONDS");
  const feedCount = await config.getNumber("FEED.LATEST-COUNT");
  if (feedCount == null) throw new Error("Missing required config: FEED.LATEST-COUNT");

  const getPosts = cache(
    async () => listPosts({ limit: feedCount, includeViews: true }),
    ["home", `limit:${feedCount}`],
    { revalidate: revalidateSeconds, tags: ["home"] }
  );
  const { items: posts, nextCursor } = await getPosts();

  // Get view counts for all posts
  const postIds = posts.map(p => p.id);
  const viewCounts = postIds.length > 0 ? await getPostViewCounts(postIds) : new Map();

  // Merge view counts with posts
  const postsWithViews = posts.map(post => {
    const counts = viewCounts.get(post.id);
    return {
      ...post,
      viewsTotal: counts?.totalViews ?? post.viewsTotal ?? 0,
      viewsLastNDays: counts?.viewsLastNDays ?? 0,
    };
  });

  return (
    <main className="min-h-screen bg-bg text-fg">
      <Navbar variant="hero" />
      <Header />
      <div className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
        <div className="order-2 md:order-1">
          <div className="space-y-6">
            <Sidebar />
            <TrendingPosts />
          </div>
        </div>
        <div className="order-1 md:order-2">
          <LoadMore 
            initialPosts={postsWithViews} 
            initialCursor={nextCursor}
            limit={feedCount}
          />
          <ProseExample html="" />
        </div>
      </div>
        <footer className="mt-10 border-t border-border px-6 py-6 text-center text-muted">Proudly powered by <a href="https://github.com/sphildreth/narravo" target="_blank">Narravo</a>.</footer>
    </main>
  );
}
