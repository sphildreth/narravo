
import { getPostBySlug } from "@/lib/posts";
import CommentsSection from "@/components/comments/CommentsSection";

export default async function PostPage({ params }: { params: { slug: string } }) {
    const post = await getPostBySlug(params.slug);
    if (!post) {
        return <div className="container mx-auto p-6">Not found.</div>;
    }
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "";

    return (
        <main className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
            <div className="order-1 md:order-2 grid gap-6">
                <article className="article border border-border rounded-xl bg-card shadow-soft">
                    <div className="article__body p-6">
                        <header className="mb-3">
                            <div className="text-xs text-muted">{date}</div>
                            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mt-1">{post.title}</h1>
                            {post.excerpt && <p className="mt-2 text-gray-700">{post.excerpt}</p>}
                        </header>
                        <div className="prose" dangerouslySetInnerHTML={{ __html: post.bodyHtml ?? "" }} />
                    </div>
                </article>
                <CommentsSection postId={post.id} />
            </div>
        </main>
    );
}
