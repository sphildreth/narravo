// SPDX-License-Identifier: Apache-2.0
import {
  countPendingComments,
  countSpamComments,
  getRecentComments,
} from "@/lib/comments";
import { countPublishedPosts } from "@/lib/posts";
import { countUsers } from "@/lib/adminUsers";
import Link from "next/link";
import {
  ApproveButton,
  SpamButton,
} from "@/components/admin/DashboardActions";
import ServerDetails from "@/components/admin/ServerDetails";

export default async function AdminDashboardPage() {
  const [
    publishedPosts,
    pendingComments,
    spamComments,
    totalUsers,
    recentComments,
  ] = await Promise.all([
    countPublishedPosts(),
    countPendingComments(),
    countSpamComments(),
    countUsers(),
    getRecentComments(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <p className="opacity-70">Snapshot of site health and quick actions.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/posts">
          <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
            <div className="text-xs uppercase text-muted">Published Posts</div>
            <div className="mt-2 text-2xl font-semibold">{publishedPosts}</div>
          </div>
        </Link>
        <Link href="/admin/moderation?status=pending">
          <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
            <div className="text-xs uppercase text-muted">Pending Comments</div>
            <div className="mt-2 text-2xl font-semibold">{pendingComments}</div>
          </div>
        </Link>
        <Link href="/admin/moderation?status=spam">
          <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
            <div className="text-xs uppercase text-muted">Spam</div>
            <div className="mt-2 text-2xl font-semibold">{spamComments}</div>
          </div>
        </Link>
        <Link href="/admin/users">
          <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
            <div className="text-xs uppercase text-muted">Users</div>
            <div className="mt-2 text-2xl font-semibold">{totalUsers}</div>
          </div>
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-bold">Recent Comments</h2>
          {recentComments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No comments yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {recentComments.map((comment) => (
                <li
                  key={comment.id}
                  className="flex items-start justify-between"
                >
                  <div>
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
                    ></div>
                    <p className="text-xs text-muted-foreground">
                      {comment.author.name}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <ApproveButton commentId={comment.id} />
                    <SpamButton commentId={comment.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ServerDetails />
      </div>
    </div>
  );
}
