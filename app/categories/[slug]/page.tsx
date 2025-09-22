// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getPostsByCategory } from "@/lib/taxonomy";
import { getSiteMetadata } from "@/lib/rss";
import ArticleCard from "@/components/ArticleCard";
import Link from "next/link";

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) {
    return {
      title: "Category Not Found",
    };
  }

  const { title: siteName } = getSiteMetadata();
  return {
    title: `${category.name} - ${siteName}`,
    description: `Posts in the ${category.name} category`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) {
    notFound();
  }

  const { items: posts } = await getPostsByCategory(params.slug, { limit: 10 });

  return (
    <main className="max-w-screen mx-auto px-6 my-7">
      <div className="mb-8">
        <nav className="text-sm text-muted mb-4">
          <Link href="/" className="hover:text-fg">Home</Link>
          <span className="mx-2">›</span>
          <span>Categories</span>
          <span className="mx-2">›</span>
          <span className="text-fg">{category.name}</span>
        </nav>
        
        <h1 className="text-4xl font-extrabold text-fg mb-2">
          {category.name}
        </h1>
        <p className="text-muted">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} in this category
        </p>
      </div>

      <div className="grid gap-6">
        {posts.length > 0 ? (
          posts.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-muted mb-4">No posts found in this category.</p>
            <Link href="/" className="text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}