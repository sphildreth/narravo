// SPDX-License-Identifier: Apache-2.0
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import TwoFactorSetupSelector from "@/components/admin/security/TwoFactorSetupSelector";

export default async function SetupTwoFactorPage() {
  const session = await requireAdmin();
  const twoFactorEnabled = (session.user as any).twoFactorEnabled;

  // If 2FA is already enabled, redirect to security page
  if (twoFactorEnabled) {
    redirect("/admin/security");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Set Up Two-Factor Authentication</h1>
        <p className="mt-2 text-muted">
          Choose your preferred method to secure your account. We recommend passkeys for the best security and convenience.
        </p>
      </div>

      <TwoFactorSetupSelector />
    </div>
  );
}
