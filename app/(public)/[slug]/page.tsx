import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ThemeToggle from "../../../components/ThemeToggle";
import { getPostBySlug } from "../../../lib/posts";
import { db } from "../../../lib/db";
import { posts } from "../../../drizzle/schema";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export const revalidate = false;

export async function generateStaticParams() {
  const rows = await db.select({ slug: posts.slug }).from(posts);
  return rows.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    return {
      title: "Post not found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    notFound();
  }

  const themeCookie = cookies().get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";
  const publishedAt = post.publishedAt ?? post.createdAt;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-sm text-muted hover:text-brand hover:underline">
            ← Back to posts
          </Link>
          <h1 className="text-3xl font-semibold text-fg">{post.title}</h1>
          {publishedAt ? (
            <time dateTime={publishedAt.toISOString()} className="text-xs uppercase tracking-wide text-muted">
              {DATE_FORMATTER.format(publishedAt)}
            </time>
          ) : null}
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </header>

      <article className="prose prose-invert max-w-none text-fg" dangerouslySetInnerHTML={{ __html: post.html }} />
    </main>
  );
}
