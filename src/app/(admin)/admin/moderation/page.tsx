// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { Suspense } from "react";
import { getModerationData } from "./actions";
import ModerationQueue from "@/components/admin/ModerationQueue";

interface SearchParams {
  status?: "pending" | "spam" | "approved" | "deleted";
  page?: string;
  search?: string;
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin2FA();
  
  const resolvedSearchParams = await searchParams;
  const status = resolvedSearchParams.status;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search;

  const filter = {
    ...(status && { status }),
    ...(search && { search }),
  };

  return (
    <main className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Moderation Queue</h1>
        <p className="text-muted-foreground">Review and moderate comments</p>
      </div>

      <Suspense
        fallback={
          <div className="p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading comments...</p>
          </div>
        }
      >
        <ModerationQueueWrapper filter={filter} page={page} />
      </Suspense>
    </main>
  );
}

async function ModerationQueueWrapper({ 
  filter, 
  page 
}: { 
  filter: any; 
  page: number; 
}) {
  const data = await getModerationData(filter, page);
  return <ModerationQueue initialData={data} filter={filter} page={page} />;
}
