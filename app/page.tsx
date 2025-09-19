import Navbar from "@/components/Navbar";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import ArticleCard from "@/components/ArticleCard";
import ProseExample from "@/components/Prose";
export default function Page() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Navbar />
      <Header />
      <div className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
        <div className="order-2 md:order-1"><Sidebar /></div>
        <div className="order-1 md:order-2 grid gap-6"><ArticleCard /><ProseExample /></div>
      </div>
        <footer className="mt-10 border-t border-border px-6 py-6 text-center text-muted">Proudly powered by <a href="https://github.com/sphildreth/narravo" target="_blank">Narravo</a>.</footer>
    </main>
  );
}
