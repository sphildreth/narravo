// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { asc } from "drizzle-orm";

export default async function AdminUsersPage() {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .orderBy(asc(users.email))
    .limit(100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <div className="text-sm text-muted">Showing {rows.length} users</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/10 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2 truncate max-w-[40ch]" title={u.name ?? undefined}>{u.name ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

