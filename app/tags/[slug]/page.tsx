// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug, getPostsByTag } from "@/lib/taxonomy";
import { getSiteMetadata } from "@/lib/rss";
import ArticleCard from "@/components/ArticleCard";
import Link from "next/link";

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await getTagBySlug(params.slug);
  if (!tag) {
    return {
      title: "Tag Not Found",
    };
  }

  const { title: siteName } = getSiteMetadata();
  return {
    title: `${tag.name} - ${siteName}`,
    description: `Posts tagged with ${tag.name}`,
  };
}

export default async function TagPage({ params }: Props) {
  const tag = await getTagBySlug(params.slug);
  if (!tag) {
    notFound();
  }

  const { items: posts } = await getPostsByTag(params.slug, { limit: 10 });

  return (
    <main className="max-w-screen mx-auto px-6 my-7">
      <div className="mb-8">
        <nav className="text-sm text-muted mb-4">
          <Link href="/" className="hover:text-fg">Home</Link>
          <span className="mx-2">›</span>
          <span>Tags</span>
          <span className="mx-2">›</span>
          <span className="text-fg">{tag.name}</span>
        </nav>
        
        <h1 className="text-4xl font-extrabold text-fg mb-2">
          Posts tagged with "{tag.name}"
        </h1>
        <p className="text-muted">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} found
        </p>
      </div>

      <div className="grid gap-6">
        {posts.length > 0 ? (
          posts.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-muted mb-4">No posts found with this tag.</p>
            <Link href="/" className="text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}