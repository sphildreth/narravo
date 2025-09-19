
/**
 * components/ArticleCard.tsx
 * Dynamic card for a post. Replaces hard-coded markup.
 */
import Link from "next/link";
import Image from "next/image";

export type ArticleCardPost = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  coverImage?: string | null; // optional
  author?: { name?: string | null; image?: string | null } | null;
};

export default function ArticleCard({ post }: { post: ArticleCardPost }) {
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : null;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:shadow-md">
      {post.coverImage && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/20">
          <Image
            src={post.coverImage}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 720px"
            priority={false}
          />
        </div>
      )}
      <div className="p-5">
        {date && <div className="text-xs text-muted mb-1">{date}</div>}
        <h2 className="text-[22px] leading-snug font-extrabold tracking-tight">
          <Link href={`/${post.slug}`} className="text-fg no-underline hover:underline">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
        )}
        {post.author?.name && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            {post.author?.image && (
              <img src={post.author.image} alt="" className="h-5 w-5 rounded-full" />
            )}
            <span className="font-medium text-fg">{post.author.name}</span>
          </div>
        )}
      </div>
    </article>
  );
}
