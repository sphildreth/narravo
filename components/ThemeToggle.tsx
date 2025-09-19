"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_COOKIE = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const isTheme = (value: string | undefined): value is Theme => value === "light" || value === "dark";

const getCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  if (!match) return undefined;

  const [, rawValue] = match.split("=");
  return decodeURIComponent(rawValue ?? "");
};

const setDocumentTheme = (nextTheme: Theme) => {
  document.documentElement.dataset.theme = nextTheme;
};

const writeCookie = (theme: Theme) => {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
};

interface ThemeToggleProps {
  initialTheme?: Theme;
}

export default function ThemeToggle({ initialTheme = "light" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const persistTheme = useCallback(async (nextTheme: Theme) => {
    try {
      await fetch("/theme/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ theme: nextTheme }),
      });
    } catch (error) {
      console.error("Failed to persist theme", error);
    }
  }, []);

  useEffect(() => {
    const cookieTheme = getCookie(THEME_COOKIE);
    const prefersDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const nextTheme: Theme = isTheme(cookieTheme)
      ? cookieTheme
      : prefersDark
      ? "dark"
      : "light";

    setDocumentTheme(nextTheme);
    setTheme(nextTheme);

    if (!isTheme(cookieTheme)) {
      writeCookie(nextTheme);
      void persistTheme(nextTheme);
    }
  }, [persistTheme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setDocumentTheme(nextTheme);
    writeCookie(nextTheme);
    void persistTheme(nextTheme);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-fg shadow-soft transition-colors hover:bg-brand hover:text-brand-contrast"
      aria-pressed={isDark}
      aria-label={`Activate ${isDark ? "light" : "dark"} theme`}
    >
      <span>{isDark ? "Dark" : "Light"} mode</span>
    </button>
  );
}
