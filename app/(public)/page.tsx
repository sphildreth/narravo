import Link from "next/link";
import { cookies } from "next/headers";

import ThemeToggle from "../../components/ThemeToggle";
import { listPosts } from "../../lib/posts";

export const revalidate = 60;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

type SearchParams = Record<string, string | string[] | undefined>;

const parsePageParam = (raw: string | string[] | undefined) => {
  if (!raw) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export default async function Home({ searchParams }: { searchParams?: SearchParams }) {
  const requestedPage = parsePageParam(searchParams?.page) ?? 1;
  const posts = await listPosts({ page: requestedPage });

  const themeCookie = cookies().get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-semibold text-fg">Narravo</h1>
          <p className="text-sm text-muted">Long-form publishing powered by static rendering</p>
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </header>

      <section className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-medium text-fg">Latest posts</h2>
          <p className="text-sm text-muted">
            Page {posts.page} of {posts.totalPages}
          </p>
        </div>

        {posts.items.length === 0 ? (
          <p className="text-muted">No posts published yet.</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {posts.items.map((post) => {
              const publishedDisplay = post.publishedAt ?? post.createdAt;
              const formattedDate = publishedDisplay ? DATE_FORMATTER.format(publishedDisplay) : undefined;

              return (
                <li key={post.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <article className="flex flex-col gap-3">
                    <header className="flex flex-col gap-1">
                      <Link href={`/${post.slug}`} className="text-lg font-semibold text-brand hover:underline">
                        {post.title}
                      </Link>
                      {formattedDate ? <span className="text-xs uppercase tracking-wide text-muted">{formattedDate}</span> : null}
                    </header>
                    {post.excerpt ? (
                      <p className="text-sm text-muted">{post.excerpt}</p>
                    ) : (
                      <p className="text-sm text-muted">No excerpt provided.</p>
                    )}
                    <Link href={`/${post.slug}`} className="text-sm font-medium text-brand hover:underline">
                      Read more
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <nav className="flex items-center justify-between gap-4 border-t border-border pt-4 text-sm text-muted">
        {posts.hasPrevPage ? (
          <Link href={`/?page=${posts.page - 1}`} className="text-brand hover:underline">
            ← Newer posts
          </Link>
        ) : (
          <span />
        )}

        {posts.hasNextPage ? (
          <Link href={`/?page=${posts.page + 1}`} className="text-brand hover:underline">
            Older posts →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
