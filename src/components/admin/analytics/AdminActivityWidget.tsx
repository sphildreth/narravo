// SPDX-License-Identifier: Apache-2.0
import Link from "next/link";
import { unstable_cache as cache } from "next/cache";
import { getSiteAnalyticsSummary } from "@/lib/analytics";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

export default async function AdminActivityWidget() {
  const config = new ConfigServiceImpl({ db });
  const trendingDays = (await config.getNumber("VIEW.TRENDING-DAYS")) ?? 7;
  const revalidateSeconds = (await config.getNumber("VIEW.REVALIDATE-SECONDS")) ?? 60;

  const getSummary = cache(
    async () => getSiteAnalyticsSummary({ days: trendingDays, topN: 5 }),
    ["admin:analytics:summary", `days:${trendingDays}`],
    { revalidate: revalidateSeconds, tags: ["analytics:trending"] }
  );

  const { totalViewsAllTime, viewsLastNDays, postViewsLastNDays, pageViewsLastNDays, topPosts, topPages } = await getSummary();

  const formatViewCount = (n: number) => {
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1_000_000).toFixed(1)}m`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Site Activity</h2>
        <Link href="/admin/analytics" className="text-sm text-primary hover:underline">View details</Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs uppercase text-muted">Total Views (last {trendingDays}d)</div>
          <div className="mt-1 text-xl font-semibold">{formatViewCount(viewsLastNDays)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs uppercase text-muted">Post Views (last {trendingDays}d)</div>
          <div className="mt-1 text-xl font-semibold">{formatViewCount(postViewsLastNDays)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs uppercase text-muted">Page Views (last {trendingDays}d)</div>
          <div className="mt-1 text-xl font-semibold">{formatViewCount(pageViewsLastNDays)}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs uppercase text-muted">Views (all time)</div>
          <div className="mt-1 text-xl font-semibold">{formatViewCount(totalViewsAllTime)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {topPosts.length > 0 && (
          <div>
            <div className="text-xs uppercase text-muted mb-2">Top posts (last {trendingDays}d)</div>
            <ul className="space-y-2">
              {topPosts.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <Link href={`/${p.slug}`} className="truncate hover:underline">
                      {p.title}
                    </Link>
                  </div>
                  <div className="ml-2 shrink-0 text-xs text-muted">
                    {formatViewCount(p.viewsLastNDays || 0)} recent
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {topPages.length > 0 && (
          <div>
            <div className="text-xs uppercase text-muted mb-2">Top pages (last {trendingDays}d)</div>
            <ul className="space-y-2">
              {topPages.map((page, i) => (
                <li key={page.path} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <Link href={page.path} className="truncate hover:underline font-mono">
                      {page.path}
                    </Link>
                  </div>
                  <div className="ml-2 shrink-0 text-xs text-muted">
                    {formatViewCount(page.viewsLastNDays || 0)} recent
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
