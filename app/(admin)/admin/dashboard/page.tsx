// SPDX-License-Identifier: Apache-2.0
export default function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <p className="opacity-70">Snapshot of site health and quick actions.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted">Published Posts</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted">Pending Comments</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted">Spam</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted">Users</div>
          <div className="mt-2 text-2xl font-semibold">—</div>
        </div>
      </div>
    </div>
  );
}

