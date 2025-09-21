// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { promises as fs } from "fs";

async function getPostgresVersion() {
  const result: any = await db.execute(sql`SELECT version()`);
  return result.rows[0].version;
}

async function getAppVersion() {
  const packageJson = await fs.readFile(
    process.cwd() + "/package.json",
    "utf8"
  );
  return JSON.parse(packageJson).version;
}

export default async function ServerDetails() {
  const [pgVersion, appVersion] = await Promise.all([
    getPostgresVersion(),
    getAppVersion(),
  ]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-bold">System Details</h2>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li className="flex justify-between">
          <span>Application Version:</span>
          <span className="font-mono">{appVersion}</span>
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
