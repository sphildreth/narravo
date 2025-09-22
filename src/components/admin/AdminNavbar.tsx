// SPDX-License-Identifier: Apache-2.0
import Link from "next/link";

export default function AdminNavbar() {
    return (
        <aside className="w-56 shrink-0 border-r border-border bg-bg">
            <div className="p-4 text-xs font-extrabold uppercase tracking-wide text-muted">Admin</div>
            <nav className="flex flex-col gap-1 p-2">
                <Link href="/admin/dashboard" className="rounded-lg px-3 py-2 hover:bg-muted/20">Dashboard</Link>
                <div className="mt-3 px-3 text-[11px] uppercase tracking-wide text-muted">Data</div>
                <Link href="/admin/analytics" className="rounded-lg px-3 py-2 hover:bg-muted/20">Analytics</Link>
                <Link href="/admin/moderation" className="rounded-lg px-3 py-2 hover:bg-muted/20">Moderation</Link>
                <Link href="/admin/posts" className="rounded-lg px-3 py-2 hover:bg-muted/20">Posts</Link>
                <Link href="/admin/users" className="rounded-lg px-3 py-2 hover:bg-muted/20">Users</Link>
                <div className="mt-3 px-3 text-[11px] uppercase tracking-wide text-muted">System</div>
                <Link href="/admin/system/about-me" className="rounded-lg px-3 py-2 hover:bg-muted/20">About Me</Link>
                <Link href="/admin/system/appearance" className="rounded-lg px-3 py-2 hover:bg-muted/20">Appearance</Link>
                <Link href="/admin/system/configuration" className="rounded-lg px-3 py-2 hover:bg-muted/20">Configuration</Link>
                <Link href="/admin/system/disclaimer" className="rounded-lg px-3 py-2 hover:bg-muted/20">Disclaimer</Link>
                <Link href="/admin/system/import" className="rounded-lg px-3 py-2 hover:bg-muted/20">Import</Link>
            </nav>
        </aside>
    );
}
