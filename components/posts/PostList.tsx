
import { listPosts } from "@/lib/posts";
import PostCard from "./PostCard";
import MorePosts from "./MorePosts";

export default async function PostList({ initialCursor = null, pageSize = 10 }: { initialCursor?: any, pageSize?: number }) {
  const { items, nextCursor } = await listPosts({ cursor: initialCursor, limit: pageSize });
  return (
    <div className="grid gap-6">
      {items.map((p:any) => <PostCard key={p.id} post={p} />)}
      <div className="flex justify-center">
        <MorePosts initialCursor={nextCursor} pageSize={pageSize} />
      </div>
    </div>
  );
}
