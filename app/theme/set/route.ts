/* app/theme/set/route.ts — POST to set theme cookie */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    let theme: "light" | "dark" = "light";
    try {
        const body = await req.json();
        if (body?.theme === "dark" || body?.theme === "light") {
            theme = body.theme;
        }
    } catch {}
    const res = NextResponse.json({ ok: true, theme });
    res.cookies.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
}
