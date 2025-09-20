"use client";
import * as React from "react";
import { signOut } from "next-auth/react";

type Props = {
  user: { name?: string | null; email?: string | null; image?: string | null };
};

function Avatar({ user }: Props) {
  const src = user.image ?? undefined;
  const initials = (user.name || user.email || "?").trim().slice(0, 2).toUpperCase();
  return (
    <div className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-sm font-semibold">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span>{initials}</span>}
    </div>
  );
}

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg px-2 h-9"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar user={user} />
        <span className="text-sm font-medium max-w-[10ch] truncate">{user.name || user.email || "Account"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1 shadow-soft z-50">
          <button
            role="menuitem"
            className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-muted/20"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

