// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { posts } from "@/drizzle/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export default async function AdminPostsPage() {
  const rows = await db
    .select({ id: posts.id, title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt })
    .from(posts)
    .orderBy(desc(posts.updatedAt))
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Posts</h1>
        <div className="text-sm text-muted">Showing {rows.length} items</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/10 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Title</th>
              <th className="px-3 py-2 font-semibold">Slug</th>
              <th className="px-3 py-2 font-semibold">Published</th>
              <th className="px-3 py-2 font-semibold">Updated</th>
              <th className="px-3 py-2 font-semibold">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium truncate max-w-[40ch]" title={p.title}>{p.title}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.slug}</td>
                <td className="px-3 py-2">{p.publishedAt ? new Date(p.publishedAt).toLocaleString() : "—"}</td>
                <td className="px-3 py-2">{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}</td>
                <td className="px-3 py-2"><Link href={`/${p.slug}`} className="rounded-lg border border-border px-2 py-1 hover:bg-muted/20">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

