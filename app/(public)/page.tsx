import PostList from "@/components/posts/PostList";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
export default async function Home() {
    const config = new ConfigServiceImpl({ db });
    const feedCount = await config.getNumber("FEED.LATEST-COUNT");
    if (feedCount == null) throw new Error("Missing required config: FEED.LATEST-COUNT");
    return (
        <main className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
            <div className="order-1 md:order-2">
                <PostList pageSize={feedCount} />
            </div>
        </main>
    );
}