// SPDX-License-Identifier: Apache-2.0
import Link from "next/link";
import { getArchiveMonths, getRecentPosts, type ArchiveMonth, type RecentPost } from "@/lib/sidebar";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { ChevronDown, ChevronUp } from "lucide-react";

export default async function Sidebar({ className = "" }: { className?: string }) {
  const config = new ConfigServiceImpl({ db });
  const monthsSidebar = await config.getNumber("ARCHIVE.MONTHS-SIDEBAR");
  if (monthsSidebar == null) throw new Error("Missing required config: ARCHIVE.MONTHS-SIDEBAR");
  const recentCount = await config.getNumber("FEED.LATEST-COUNT");
  if (recentCount == null) throw new Error("Missing required config: FEED.LATEST-COUNT");
  const [months, recent] = await Promise.all([getArchiveMonths(monthsSidebar), getRecentPosts(recentCount)]);
  
  return (
    <aside className={["space-y-6", className].filter(Boolean).join(" ")}>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Archive</h3>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          <ArchiveList months={months} />
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Recent</h3>
        <ul className="space-y-2">
          {recent.map((p: RecentPost) => (
            <li key={p.id} className="text-sm leading-snug">
              <Link href={`/${p.slug}`} className="hover:underline text-fg">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

// Client component for collapsible archive functionality
function ArchiveList({ months }: { months: ArchiveMonth[] }) {
  return (
    <ul className="space-y-1.5">
      {months.map((m: ArchiveMonth) => {
        // Convert key format from YYYY-MM to /archive/YYYY/MM for our routes
        const [year, month] = m.key.split('-');
        const archiveUrl = `/archive/${year}/${month}`;
        
        return (
          <li key={m.key} className="flex items-center justify-between text-sm">
            <Link href={archiveUrl} className="hover:underline text-fg">
              {m.label}
            </Link>
            <span className="text-muted">{m.count}</span>
          </li>
        );
      })}
    </ul>
  );
}
