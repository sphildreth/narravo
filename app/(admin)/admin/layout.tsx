// SPDX-License-Identifier: Apache-2.0
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminNavbar from "@/components/admin/AdminNavbar";
import Navbar from "@/components/Navbar";
import AdminHeader from "@/components/admin/AdminHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !(session.user as any).isAdmin) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      {/* Shared site header with admin context */}
      <Navbar context="admin" />
      <div className="flex min-h-[calc(100vh-56px)]">
        <AdminNavbar />
        <section className="flex-1">
          <div className="p-6">
            <AdminHeader />
            <div className="mt-4">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
