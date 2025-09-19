import Link from "next/link";
export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur border-b border-border">
      <div className="max-w-screen mx-auto px-6 py-2.5 flex items-center justify-between">
        <Link href="/" className="font-extrabold tracking-wide text-xs uppercase opacity-85 text-fg">Narravo</Link>
        <div className="flex items-center gap-2">
          <Link href="/archive" className="inline-block border border-border px-3 py-2 rounded-xl bg-white text-fg font-semibold">Archive</Link>
          <Link href="/subscribe" className="inline-block border border-transparent px-3 py-2 rounded-xl bg-brand text-brand-contrast font-semibold">Subscribe</Link>
        </div>
      </div>
    </nav>
  );
}
