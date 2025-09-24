// SPDX-License-Identifier: Apache-2.0
import Link from "next/link";
import { sanitizeHtml } from "@/lib/sanitize";

export default function PostCard({ post }: { post: any }) {
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "";
  return (
    <article className="card border border-border rounded-xl overflow-hidden bg-card shadow-soft">
      <div className="p-4">
        <div className="text-xs text-muted mb-1">{date}</div>
        <h2 className="text-[22px] font-extrabold my-1">
          <Link href={`/${post.slug}`} className="text-fg no-underline hover:underline">{post.title}</Link>
        </h2>
        {post.excerpt ? (
          <div
            className="text-gray-700 prose prose-sm max-w-none"
            // Excerpt may include basic HTML (bold, links, etc) – sanitize before rendering
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.excerpt) }}
          />
        ) : null}
      </div>
    </article>
  );
}
