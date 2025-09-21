// SPDX-License-Identifier: Apache-2.0

import { getPostBySlugWithReactions } from "@/lib/posts";
import { getSession } from "@/lib/auth";
import CommentsSection from "@/components/comments/CommentsSection";
import ReactionButtons from "@/components/reactions/ReactionButtons";
import { generatePostSEO, type SiteConfig } from "@/lib/seo";
import { Metadata } from "next";

// Site configuration for SEO
const siteConfig: SiteConfig = {
  title: 'Narravo',
  description: 'A modern blog platform',
  url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const post = await getPostBySlugWithReactions(params.slug);
    if (!post) {
        return {
            title: 'Post Not Found | Narravo',
            description: 'The requested post could not be found.',
        };
    }

    const seo = generatePostSEO(post, siteConfig);

    return {
        title: seo.title,
        description: seo.description,
        alternates: {
            canonical: seo.canonical,
        },
        openGraph: {
            ...(seo.ogTitle && { title: seo.ogTitle }),
            ...(seo.ogDescription && { description: seo.ogDescription }),
            type: seo.ogType as 'article',
            url: seo.canonical,
            ...(post.publishedAt && { publishedTime: post.publishedAt }),
        },
        twitter: {
            card: seo.twitterCard as 'summary_large_image',
            ...(seo.ogTitle && { title: seo.ogTitle }),
            ...(seo.ogDescription && { description: seo.ogDescription }),
        },
        other: {
            // Add JSON-LD structured data
            'structured-data': JSON.stringify(seo.jsonLd),
        },
    };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
    const session = await getSession();
    const userId = session?.user?.id || undefined;
    
    const post = await getPostBySlugWithReactions(params.slug, userId);
    if (!post) {
        return <div className="container mx-auto p-6">Not found.</div>;
    }
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "";

    // Generate JSON-LD for structured data
    const seo = generatePostSEO(post, siteConfig);

    return (
        <>
            {/* JSON-LD structured data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
            />
            
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
                            
                            {/* Post reactions */}
                            {post.reactions && (
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
                    <CommentsSection postId={post.id} />
                </div>
            </main>
        </>
    );
}
