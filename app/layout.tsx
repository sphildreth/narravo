import "./globals.css";
import { cookies } from "next/headers";

export const metadata = { title: "Narravo" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCookie = cookies().get("theme")?.value;
  const theme = themeCookie === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-screen bg-bg text-fg antialiased transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
