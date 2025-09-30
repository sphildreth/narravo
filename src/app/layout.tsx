// SPDX-License-Identifier: Apache-2.0
/* app/layout.tsx — SSR theme cookie reader */
import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";
import { DEFAULT_DATE_FORMAT } from "@/lib/dateFormat";
import { DateFormatProvider } from "@/lib/dateFormat.client";
import { RUMCollector } from "@/components/RUMCollector";

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
    const themeCookie = (await cookies()).get("theme")?.value;
    let theme = themeCookie ?? "light";
    // Load site-wide date format from configuration
    let dateFormat = DEFAULT_DATE_FORMAT;
    try {
        const config = new ConfigServiceImpl({ db });
        if (!themeCookie) {
            const configured = await config.getString("THEME.DEFAULT");
            if (configured === "light" || configured === "dark") theme = configured;
        }
        const cfgDate = await config.getString("VIEW.DATE-FORMAT");
        if (cfgDate && typeof cfgDate === "string" && cfgDate.trim().length > 0) {
            dateFormat = cfgDate.trim();
        }
    } catch {}
    const initialDataTheme = theme;
    return (
        <html lang="en" data-theme={initialDataTheme} suppressHydrationWarning>
        <head>
            <meta name="color-scheme" content="light dark" />
        </head>
        <body>
            <RUMCollector />
            <Navbar />
            <DateFormatProvider value={dateFormat}>
                <main className="min-h-screen bg-bg text-fg">
                    {children}
                </main>
            </DateFormatProvider>
        </body>
        </html>
    );
}
