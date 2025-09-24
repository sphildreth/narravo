"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export default function SearchBar() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = (target?.tagName || "").toLowerCase();
        const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      } else if (e.key === "Escape" && open) {
        setQuery("");
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}&page=1`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open; setOpen(next); if (next) setTimeout(()=>inputRef.current?.focus(), 0);
        }}
        aria-expanded={open}
        aria-controls="site-search"
        aria-label="Search"
        className="inline-flex items-center h-9 border border-border px-3 rounded-xl bg-bg text-fg text-sm font-semibold hover:border-accent"
      >
        <Search className="h-4 w-4 mr-2" aria-hidden />
        Search
      </button>

      {open && (
        <div id="site-search" role="search" className="absolute left-0 right-0 mt-2 z-[60]">
          <form onSubmit={onSubmit} className="flex gap-2 rounded-xl border border-border bg-bg p-2 shadow-soft">
            <label htmlFor="q" className="sr-only">Search posts</label>
            <input
              id="q"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="inline-flex items-center h-9 px-3 rounded-xl border border-border hover:border-accent" aria-label="Clear search">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <button type="submit" className="inline-flex items-center h-9 px-3 rounded-xl border border-transparent bg-brand text-brand-contrast hover:opacity-90">
              <Search className="h-4 w-4 mr-2" aria-hidden />
              Search
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
