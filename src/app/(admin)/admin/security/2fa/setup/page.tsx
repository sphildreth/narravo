// SPDX-License-Identifier: Apache-2.0
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import TotpSetupFlow from "@/components/admin/security/TotpSetupFlow";

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
          Secure your account with an authenticator app like Google Authenticator, Authy, or 1Password.
        </p>
      </div>

      <TotpSetupFlow />
    </div>
  );
}
