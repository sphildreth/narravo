/* app/layout.tsx — SSR theme cookie reader */
import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
    title: "Narravo",
    description: "Simple, modern blog",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const theme = cookies().get("theme")?.value ?? "light";
    return (
        <html lang="en" data-theme={theme} suppressHydrationWarning>
        <body>{children}</body>
        </html>
    );
}
