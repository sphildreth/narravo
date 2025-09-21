// SPDX-License-Identifier: Apache-2.0
import Navbar from "@/components/Navbar";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import ArticleCard from "@/components/ArticleCard";
import ProseExample from "@/components/Prose";
import { listPosts } from "@/lib/posts";
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
    async () => listPosts({ limit: feedCount }),
    ["home", `limit:${feedCount}`],
    { revalidate: revalidateSeconds, tags: ["home"] }
  );
  const { items: posts } = await getPosts();
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Navbar variant="hero" />
      <Header />
      <div className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
        <div className="order-2 md:order-1"><Sidebar /></div>
        <div className="order-1 md:order-2 grid gap-6">
          {posts.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))}
          <ProseExample html="" />
        </div>
      </div>
        <footer className="mt-10 border-t border-border px-6 py-6 text-center text-muted">Proudly powered by <a href="https://github.com/sphildreth/narravo" target="_blank">Narravo</a>.</footer>
    </main>
  );
}
