// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { APP_VERSION, GIT_SHA, BUILD_TIME } from "@/version";

async function getPostgresVersion() {
  const result: any = await db.execute(sql`SELECT version()`);
  return result.rows[0].version;
}

export default async function ServerDetails() {
  const pgVersion = await getPostgresVersion();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-bold">System Details</h2>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li className="flex justify-between">
          <span>Application Version:</span>
          <span className="font-mono">
            {APP_VERSION} ({GIT_SHA})
          </span>
        </li>
        <li className="flex justify-between">
          <span>Build Time:</span>
          <span className="font-mono">{BUILD_TIME}</span>
        </li>
        <li className="flex justify-between">
          <span>Node.js Version:</span>
          <span className="font-mono">{process.version}</span>
        </li>
        <li className="flex justify-between">
          <span>PostgreSQL Version:</span>
          <span className="font-mono">{pgVersion.split(" ")[1]}</span>
        </li>
        <li className="flex justify-between">
          <span>Environment:</span>
          <span className="font-mono">{process.env.NODE_ENV}</span>
        </li>
      </ul>
    </div>
  );
}
