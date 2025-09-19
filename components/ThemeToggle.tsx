/* components/ThemeToggle.tsx — client toggle with SSR cookie write */
"use client";
import * as React from "react";
export default function ThemeToggle() {
    const [theme, setTheme] = React.useState<"light" | "dark">("light");
    React.useEffect(() => {
        const el = document.documentElement;
        const current = (el.dataset.theme as "light" | "dark" | undefined) ?? undefined;
        if (current) {
            setTheme(current);
        } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            setTheme("dark");
            el.dataset.theme = "dark";
        }
    }, []);
    const applyTheme = async (next: "light" | "dark") => {
        document.documentElement.dataset.theme = next;
        setTheme(next);
        try {
            await fetch("/theme/set", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) });
        } catch {}
    };
    return (
        <button onClick={() => applyTheme(theme === "dark" ? "light" : "dark")} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 bg-bg text-fg" aria-label="Toggle color theme" title="Toggle theme">
            <span className="inline-block w-4 h-4 rounded-full" style={{ background: theme === "dark" ? "var(--brand)" : "var(--accent)" }} />
            <span className="text-sm font-semibold">{theme === "dark" ? "Dark" : "Light"}</span>
        </button>
    );
}
