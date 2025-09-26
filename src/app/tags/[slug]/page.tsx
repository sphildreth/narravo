// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug, getPostsByTag } from "@/lib/taxonomy";
import { getSiteMetadata } from "@/lib/rss";
import ArticleCard from "@/components/ArticleCard";
import Link from "next/link";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const tag = await getTagBySlug(resolvedParams.slug);
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

interface TagPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const postsResult = await getPostsByTag(resolvedParams.slug);
  const tag = postsResult.items.length > 0 ? postsResult.items[0]?.tags?.find((t: any) => t.slug === resolvedParams.slug) : null;
  const page = parseInt(resolvedSearchParams.page || "1", 10);

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
          Posts tagged with "{tag?.name || resolvedParams.slug}"
        </h1>
        <p className="text-muted">
          {postsResult.items.length} {postsResult.items.length === 1 ? 'post' : 'posts'} found
        </p>
      </div>

      <div className="grid gap-6">
        {postsResult.items.length > 0 ? (
          postsResult.items.map((post: any) => (
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