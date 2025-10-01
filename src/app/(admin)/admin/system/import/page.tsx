// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { importJobs, importJobErrors } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import ImportManager from "@/components/admin/import/ImportManager";

export default async function ImportPage() {
  await requireAdmin2FA();

  // Get recent import jobs
  const jobs = await db
    .select()
    .from(importJobs)
    .orderBy(desc(importJobs.createdAt))
    .limit(10);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">WordPress Import</h1>
      <p className="opacity-70">
        Import WordPress WXR (XML) export files. This will import posts, comments, categories, tags, 
        media attachments, and create redirects from old URLs.
      </p>
      <ImportManager initialJobs={jobs} />
    </div>
  );
}