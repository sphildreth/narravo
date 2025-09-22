"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { setTheme } from "@/app/actions/theme";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  initialTheme?: "light" | "dark";
}

export default function ThemeToggle({ initialTheme = "light" }: ThemeToggleProps) {
  const [theme, setCurrentTheme] = React.useState<"light" | "dark">(initialTheme);

  React.useEffect(() => {
    const current = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    if (current && current !== theme) {
      setCurrentTheme(current);
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = newTheme;
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 bg-bg text-fg"
      aria-label="Toggle color theme"
      aria-pressed={theme === "dark"}
      title="Toggle theme"
    >
      {theme === "light" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
      <span className="text-sm font-semibold capitalize">{theme}</span>
    </button>
  );
}
