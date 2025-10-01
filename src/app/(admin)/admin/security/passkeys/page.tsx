// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Key } from "lucide-react";
import DeletePasskeyButton from "@/components/admin/security/DeletePasskeyButton";
import AddPasskeyButton from "@/components/admin/security/AddPasskeyButton";

export default async function PasskeysPage() {
  const session = await requireAdmin2FA();

  // Fetch all passkeys for this user
  const passkeys = await db
    .select()
    .from(ownerWebAuthnCredential)
    .where(eq(ownerWebAuthnCredential.userId, session.user!.id))
    .orderBy(desc(ownerWebAuthnCredential.createdAt));

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
        <h1 className="text-2xl font-bold">Passkey Management</h1>
        <p className="mt-2 text-muted">
          Passkeys (WebAuthn) provide secure, passwordless authentication using biometrics or security keys.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Your Passkeys</h2>
              <p className="text-sm text-muted">
                {passkeys.length === 0 ? "No passkeys registered" : `${passkeys.length} ${passkeys.length === 1 ? "passkey" : "passkeys"} registered`}
              </p>
            </div>
          </div>
          <AddPasskeyButton />
        </div>

        {passkeys.length > 0 && (
          <div className="mt-6 space-y-3">
            {passkeys.map((passkey: typeof ownerWebAuthnCredential.$inferSelect) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between rounded-md border border-border bg-bg p-4"
              >
                <div className="flex-1">
                  <div className="font-medium">{passkey.nickname || "Unnamed Passkey"}</div>
                  <div className="mt-1 text-xs text-muted">
                    ID: {passkey.credentialId.slice(0, 16)}...
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Created: {passkey.createdAt ? new Date(passkey.createdAt).toLocaleString() : "Unknown"}
                  </div>
                  {passkey.lastUsedAt && (
                    <div className="mt-1 text-xs text-muted">
                      Last used: {new Date(passkey.lastUsedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <DeletePasskeyButton passkeyId={passkey.id} passkeyName={passkey.nickname} />
              </div>
            ))}
          </div>
        )}

        {passkeys.length === 0 && (
          <div className="mt-6 rounded-md border border-dashed border-border bg-muted/10 p-8 text-center">
            <Key className="mx-auto h-12 w-12 text-muted" />
            <p className="mt-3 text-sm text-muted">
              No passkeys registered yet. Add a passkey to enable passwordless authentication.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
        <h3 className="text-sm font-medium text-blue-600 dark:text-blue-500">
          About Passkeys
        </h3>
        <p className="mt-2 text-xs text-muted">
          Passkeys use your device's built-in security (Face ID, Touch ID, Windows Hello, or a hardware security key) 
          to verify your identity. They're more secure than passwords and can't be phished.
        </p>
      </div>
    </div>
  );
}
