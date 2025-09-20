import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminNavbar from "@/components/admin/AdminNavbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !(session.user as any).isAdmin) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="flex min-h-screen">
        <AdminNavbar />
        <section className="flex-1">
          <header className="sticky top-0 z-40 border-b border-border bg-white/75 backdrop-blur">
            <div className="px-6 py-3 text-sm font-semibold">Admin Portal</div>
          </header>
          <div className="p-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

