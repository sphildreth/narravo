"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { setTheme } from "@/app/actions/theme";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps { initialTheme?: 'light' | 'dark'; }

export default function ThemeToggle({ initialTheme = 'light' }: ThemeToggleProps) {
  const [theme, setThemeState] = React.useState<'light' | 'dark'>(initialTheme);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    startTransition(() => { void setTheme(next); });
    try {
      document.cookie = `theme=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax` + (location.protocol === 'https:' ? '; Secure' : '');
    } catch {}
  };

  const ariaLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  const title = ariaLabel + (isPending ? '…' : '');

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
      aria-label={ariaLabel}
      aria-pressed={theme === 'dark'}
      title={title}
      disabled={isPending}
    >
      {theme === 'light' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      <span className="text-sm font-semibold capitalize">{theme}</span>
    </button>
  );
}
