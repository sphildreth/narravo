export default function Sidebar() {
  return (
    <aside className="sticky top-16 h-max border border-border rounded-xl shadow-soft bg-card">
      <section className="p-4 border-b border-border">
        <h3 className="mt-1 mb-2 text-xs tracking-wider uppercase opacity-75">Search</h3>
        <input className="w-full px-3 py-2 border border-border rounded-xl bg-bg text-fg" placeholder="Search..." />
      </section>
      <section className="p-4 border-b border-border">
        <h3 className="mt-1 mb-2 text-xs tracking-wider uppercase opacity-75">Archives</h3>
        <ul className="space-y-2">
          {[
            ["September 2025", 12],
            ["August 2025", 8],
            ["July 2025", 15],
          ].map(([label, count]) => (
            <li key={String(label)}>
              <a className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 text-fg" href="#">
                <span>{String(label)}</span>
                <span className="text-muted">{String(count)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="p-4">
        <h3 className="mt-1 mb-2 text-xs tracking-wider uppercase opacity-75">About</h3>
        <p className="m-0 text-muted">Short bio or callout.</p>
      </section>
    </aside>
  );
}
