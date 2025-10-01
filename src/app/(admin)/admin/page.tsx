// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminIndexPage() {
  await requireAdmin2FA();

  redirect("/admin/dashboard");
}

