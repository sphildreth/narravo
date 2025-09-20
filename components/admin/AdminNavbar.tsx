import Link from "next/link";

export default function AdminNavbar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg">
      <div className="p-4 text-xs font-extrabold uppercase tracking-wide text-muted">Admin</div>
      <nav className="flex flex-col gap-1 p-2">
        <Link href="/admin/dashboard" className="rounded-lg px-3 py-2 hover:bg-muted/20">Dashboard</Link>
        <Link href="/admin/moderation" className="rounded-lg px-3 py-2 hover:bg-muted/20">Moderation</Link>
      </nav>
    </aside>
  );
}
