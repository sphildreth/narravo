export default function ArticleCard() {
  return (
    <article className="border border-border rounded-xl overflow-hidden bg-card shadow-soft">
      <div className="aspect-[16/9] bg-gray-200" style={{ background: "url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop) center / cover" }} />
      <div className="p-4">
        <div className="text-xs text-muted mb-1">Sep 19, 2025 • 5 min read</div>
        <h2 className="text-[22px] font-extrabold my-1"><a href="#" className="text-fg no-underline">Writing with focus</a></h2>
        <p className="text-gray-700">A short excerpt of the article to entice reading—clean lines, generous whitespace, and accessible contrast…</p>
      </div>
    </article>
  );
}
