"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { setTheme } from "@/app/actions/theme";

export default function ThemeToggle() {
  const [theme, setCurrentTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const current = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    if (current) {
      setCurrentTheme(current);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = newTheme;
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 bg-bg text-fg"
      aria-label="Toggle color theme"
      title="Toggle theme"
    >
      <span className="text-sm font-semibold capitalize">{theme}</span>
    </button>
  );
}
