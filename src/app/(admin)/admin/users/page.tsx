// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { Suspense } from "react";
import { getUsersWithFilters, type UsersFilter, type UsersSortOptions } from "./actions";
import UsersManager from "@/components/admin/users/UsersManager";

interface SearchParams {
  search?: string;
  isAdmin?: string;
  sortField?: "email" | "name" | "createdAt" | "commentsCount" | "reactionsCount";
  sortDirection?: "asc" | "desc";
  page?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin2FA();
  
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  
  const filter: UsersFilter = {
    ...(resolvedSearchParams.search && { search: resolvedSearchParams.search }),
    ...(resolvedSearchParams.isAdmin !== undefined && { 
      isAdmin: resolvedSearchParams.isAdmin === "true" 
    }),
  };
  
  const sort: UsersSortOptions = {
    field: resolvedSearchParams.sortField || "email",
    direction: resolvedSearchParams.sortDirection || "asc",
  };

  return (
    <main className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      <Suspense
        fallback={
          <div className="p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading users...</p>
          </div>
        }
      >
        <UsersManagerWrapper filter={filter} sort={sort} page={page} />
      </Suspense>
    </main>
  );
}

async function UsersManagerWrapper({ 
  filter, 
  sort,
  page 
}: { 
  filter: UsersFilter; 
  sort: UsersSortOptions;
  page: number; 
}) {
  const data = await getUsersWithFilters(filter, sort, page);
  return <UsersManager initialData={data} filter={filter} sort={sort} page={page} />;
}

