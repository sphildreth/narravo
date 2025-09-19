export default function Header() {
  return (
    <header className="relative text-white min-h-[38vh] flex items-end overflow-hidden bg-[#111]">
      <div className="absolute inset-0 bg-center bg-cover brightness-75 scale-[1.02]" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1520509414578-d9cbf09933a1?q=80&w=1600&auto=format&fit=crop)" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/45 to-black/55" />
      <div className="relative z-10 w-full max-w-screen mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-9 h-9 rounded-xl bg-brand shadow-soft inline-block" />
          <span className="font-extrabold tracking-wide text-xs uppercase opacity-90">Narravo</span>
        </div>
        <h1 className="text-[clamp(28px,6vw,56px)] font-extrabold">A clean, personal blog layout</h1>
        <p className="text-[clamp(14px,2.5vw,18px)] opacity-90 max-w-[64ch]">Fast, minimalist, content-first. Wide banner image, simple two-column layout, tidy article typography.</p>
      </div>
    </header>
  );
}
