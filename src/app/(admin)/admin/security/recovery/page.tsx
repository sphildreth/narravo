// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerRecoveryCode } from "@/drizzle/schema";
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import RegenerateRecoveryCodesButton from "@/components/admin/security/RegenerateRecoveryCodesButton";

export default async function RecoveryCodesPage() {
  const session = await requireAdmin2FA();

  // Count remaining recovery codes
  const result = await db
    .select({ count: count() })
    .from(ownerRecoveryCode)
    .where(eq(ownerRecoveryCode.userId, session.user!.id));

  const remainingCodes = result[0]?.count ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/security"
          className="flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Security
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Recovery Codes</h1>
        <p className="mt-2 text-muted">
          Recovery codes are one-time use codes that allow you to access your account if you lose your authenticator device.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Recovery Codes Status</h2>
            <p className="text-sm text-muted">
              {remainingCodes === 0 && "No recovery codes available. Generate new codes immediately."}
              {remainingCodes > 0 && `${remainingCodes} of 10 recovery codes remaining`}
            </p>
          </div>
          {remainingCodes === 0 && (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-500">
              Critical
            </span>
          )}
          {remainingCodes > 0 && remainingCodes <= 3 && (
            <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-600 dark:text-yellow-500">
              Low
            </span>
          )}
          {remainingCodes > 3 && (
            <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-500">
              {remainingCodes} Remaining
            </span>
          )}
        </div>

        <div className="mt-6">
          <RegenerateRecoveryCodesButton currentCount={remainingCodes} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold">Important Information</h3>
        <ul className="space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Each recovery code can only be used once.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Store your codes in a secure location (password manager, encrypted file, etc.).</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Regenerating codes will invalidate all existing codes.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>If you run out of codes and lose your authenticator, you'll need to contact support.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
