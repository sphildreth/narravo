// SPDX-License-Identifier: Apache-2.0
/* components/Navbar.withTheme.tsx — example of using the toggle in a navbar */
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { auth } from "@/lib/auth";
import UserMenu from "@/components/auth/UserMenu";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import Image from "next/image";

export default async function Navbar({ context, variant }: { context?: "admin" | "site"; variant?: "default" | "hero" }) {
    const session = await auth();
    const isAdmin = Boolean(session?.user && (session.user as any).isAdmin);
    const isLoggedIn = Boolean(session?.user);
    const userForMenu = isLoggedIn ? { name: session!.user!.name ?? null, email: session!.user!.email ?? null, image: (session!.user as any).image ?? null } : null;
    const config = new ConfigServiceImpl({ db });
    const siteName = (await config.getString("SITE.NAME")) ?? "Narravo";
    const borderClass = variant === "hero" ? "border-b-0" : "border-b border-border";
    return (
        <nav className={`sticky top-0 z-50 bg-bg/80 backdrop-blur ${borderClass}`}>
            <div className="max-w-screen mx-auto px-6 py-2.5 flex items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-2">
                    <Image src="/images/logo-60x57.png" alt={`${siteName} logo`} width={24} height={23} className="inline-block rounded-md" />
                    <span className="font-extrabold tracking-wide text-xs uppercase text-fg">{siteName}</span>
                </Link>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {context === "admin" && (
                        <Link href="/" className="inline-flex items-center h-9 border border-border px-3 rounded-xl bg-bg text-fg text-sm font-semibold hover:border-accent">View site</Link>
                    )}
                    {context !== "admin" && isAdmin && (
                        <Link href="/admin/dashboard" className="inline-flex items-center h-9 border border-transparent px-3 rounded-xl bg-brand text-brand-contrast text-sm font-semibold">Admin</Link>
                    )}
                    {isLoggedIn && userForMenu ? (
                        <UserMenu user={userForMenu} />
                    ) : (
                        <Link href="/login" className="inline-flex items-center h-9 border border-border px-3 rounded-xl bg-bg text-fg text-sm font-semibold hover:border-accent">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
