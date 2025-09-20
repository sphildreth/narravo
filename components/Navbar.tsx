/* components/Navbar.withTheme.tsx — example of using the toggle in a navbar */
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { auth } from "@/lib/auth";

export default async function Navbar() {
    const session = await auth();
    const isAdmin = Boolean(session?.user && (session.user as any).isAdmin);
    const isLoggedIn = Boolean(session?.user);
    return (
        <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur border-b border-border">
            <div className="max-w-screen mx-auto px-6 py-2.5 flex items-center justify-between">
                <Link href="/" className="font-extrabold tracking-wide text-xs uppercase opacity-85 text-fg">Narravo</Link>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {!isLoggedIn && (
                        <Link href="/login" className="inline-block border border-border px-3 py-2 rounded-xl bg-bg text-fg font-semibold hover:border-accent">Login</Link>
                    )}
                    {isAdmin && (
                        <Link href="/admin/dashboard" className="inline-block border border-transparent px-3 py-2 rounded-xl bg-brand text-brand-contrast font-semibold">Admin</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
