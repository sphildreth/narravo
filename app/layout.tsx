// SPDX-License-Identifier: Apache-2.0
/* app/layout.tsx — SSR theme cookie reader */
import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import Banner from "@/components/Banner"; // Import Banner component

export async function generateMetadata(): Promise<Metadata> {
    try {
        const config = new ConfigServiceImpl({ db });
        const siteName = (await config.getString("SITE.NAME")) ?? "Narravo";
        return {
            title: siteName,
            manifest: "/site.webmanifest",
            description: "Simple, modern blog",
        };
    } catch {
        return {
            title: "Narravo",
            manifest: "/site.webmanifest",
            description: "Simple, modern blog",
        };
    }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const themeCookie = cookies().get("theme")?.value;
    let theme = themeCookie ?? "light";
    if (!themeCookie) {
        try {
            const config = new ConfigServiceImpl({ db });
            const configured = await config.getString("THEME.DEFAULT");
            if (configured === "light" || configured === "dark") theme = configured;
        } catch {}
    }
    return (
        <html lang="en" data-theme={theme} suppressHydrationWarning>
        <body>
            <Banner /> {/* Add Banner component here */}
            {children}
        </body>
        </html>
    );
}
