
import Link from "next/link";
import { getArchiveMonths, getRecentPosts } from "@/lib/sidebar";

export default async function Sidebar({ className = "" }: { className?: string }) {
  const [months, recent] = await Promise.all([getArchiveMonths(24), getRecentPosts(10)]);
  return (
    <aside className={["space-y-6", className].filter(Boolean).join(" ")}>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Archive</h3>
        <ul className="space-y-1.5">
          {months.map((m:any) => (
            <li key={m.key} className="flex items-center justify-between text-sm">
              <Link href={`/?m=${m.key}`} className="hover:underline text-fg">{m.label}</Link>
              <span className="text-muted">{m.count}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Recent</h3>
        <ul className="space-y-2">
          {recent.map((p:any) => (
            <li key={p.id} className="text-sm leading-snug">
              <Link href={`/${p.slug}`} className="hover:underline text-fg">{p.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
