// SPDX-License-Identifier: Apache-2.0
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TwoFactorVerification from "@/components/auth/TwoFactorVerification";

export default async function TwoFactorAuthPage() {
  const session = await getSession();

  // Not authenticated at all - go to login
  if (!session?.user) {
    redirect("/login");
  }

  // 2FA not enabled or already verified - go to home
  if (!(session.user as any).twoFactorEnabled || !(session.user as any).mfaPending) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm text-muted">
            Enter your verification code to complete sign in
          </p>
        </div>

        <TwoFactorVerification />
      </div>
    </div>
  );
}
