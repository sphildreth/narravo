import Link from "next/link";
export default function PostCard({ post }: { post: any }) {
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "";
  return (
    <article className="card border border-border rounded-xl overflow-hidden bg-card shadow-soft">
      <div className="p-4">
        <div className="text-xs text-muted mb-1">{date}</div>
        <h2 className="text-[22px] font-extrabold my-1">
          <Link href={`/${post.slug}`} className="text-fg no-underline hover:underline">{post.title}</Link>
        </h2>
        {post.excerpt && <p className="text-gray-700">{post.excerpt}</p>}
      </div>
    </article>
  );
}
