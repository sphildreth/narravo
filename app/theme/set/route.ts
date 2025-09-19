import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const THEME_COOKIE = "theme";
const VALID_THEMES = new Set(["light", "dark"]);
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type Theme = "light" | "dark";

export async function POST(request: Request) {
  let requestedTheme: string | undefined;

  try {
    const body = await request.json();
    requestedTheme = typeof body?.theme === "string" ? body.theme : undefined;
  } catch {
    requestedTheme = undefined;
  }

  if (!requestedTheme || !VALID_THEMES.has(requestedTheme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  const theme = requestedTheme as Theme;
  const cookieStore = cookies();
  cookieStore.set({
    name: THEME_COOKIE,
    value: theme,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ theme });
}
