// SPDX-License-Identifier: Apache-2.0
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerTotp, ownerWebAuthnCredential, ownerRecoveryCode, trustedDevice } from "@/drizzle/schema";
import { eq, isNull, gt } from "drizzle-orm";
import Link from "next/link";
import { ShieldCheck, Smartphone, Key, Fingerprint, Laptop } from "lucide-react";
import DisableTwoFactorButton from "@/components/admin/security/DisableTwoFactorButton";

export default async function SecurityPage() {
  const session = await requireAdmin();
  const userId = (session.user as any).id;
  const twoFactorEnabled = (session.user as any).twoFactorEnabled;

  // Get TOTP status
  const [totp] = await db
    .select()
    .from(ownerTotp)
    .where(eq(ownerTotp.userId, userId))
    .limit(1);

  // Get WebAuthn credentials
  const credentials = await db
    .select()
    .from(ownerWebAuthnCredential)
    .where(eq(ownerWebAuthnCredential.userId, userId));

  // Get recovery codes
  const recoveryCodes = await db
    .select()
    .from(ownerRecoveryCode)
    .where(eq(ownerRecoveryCode.userId, userId));

  const unusedRecoveryCodes = recoveryCodes.filter((rc: any) => !rc.usedAt);

  // Get trusted devices
  const now = new Date();
  const devices = await db
    .select()
    .from(trustedDevice)
    .where(
      eq(trustedDevice.userId, userId)
    );

  const activeDevices = devices.filter(
    (d: any) => !d.revokedAt && d.expiresAt > now
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-2 text-muted">
          Manage two-factor authentication and trusted devices.
        </p>
      </div>

      {/* 2FA Status */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className={`rounded-full p-3 ${twoFactorEnabled ? 'bg-green-500/10' : 'bg-muted/20'}`}>
            <ShieldCheck className={`h-6 w-6 ${twoFactorEnabled ? 'text-green-500' : 'text-muted'}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
            <p className="mt-1 text-sm text-muted">
              {twoFactorEnabled
                ? "Two-factor authentication is enabled on your account."
                : "Add an extra layer of security to your account."}
            </p>
            {!twoFactorEnabled && (
              <Link
                href="/admin/security/2fa/setup"
                className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90"
              >
                Enable Two-Factor Authentication
              </Link>
            )}
          </div>
        </div>
      </div>

      {twoFactorEnabled && (
        <>
          {/* TOTP Authenticator */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-muted/20 p-3">
                <Smartphone className="h-6 w-6 text-muted" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Authenticator App</h3>
                <p className="mt-1 text-sm text-muted">
                  {totp?.activatedAt
                    ? `Activated ${new Date(totp.activatedAt).toLocaleDateString()}`
                    : "Not configured"}
                </p>
                {totp?.activatedAt && (
                  <p className="mt-1 text-xs text-muted">
                    Last used: {totp.lastUsedAt ? new Date(totp.lastUsedAt).toLocaleString() : "Never"}
                  </p>
                )}
              </div>
              <div>
                {totp?.activatedAt ? (
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-500">
                    Active
                  </span>
                ) : (
                  <Link
                    href="/admin/security/2fa/setup"
                    className="text-sm text-primary hover:underline"
                  >
                    Set up
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* WebAuthn / Passkeys */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-muted/20 p-3">
                <Fingerprint className="h-6 w-6 text-muted" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Passkeys & Security Keys</h3>
                <p className="mt-1 text-sm text-muted">
                  {credentials.length === 0
                    ? "No passkeys configured"
                    : `${credentials.length} passkey${credentials.length !== 1 ? "s" : ""} registered`}
                </p>
                {credentials.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {credentials.map((cred: any) => (
                      <div
                        key={cred.id}
                        className="flex items-center justify-between rounded-md bg-muted/10 p-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">
                            {cred.nickname || "Unnamed passkey"}
                          </div>
                          <div className="text-xs text-muted">
                            Added {new Date(cred.createdAt).toLocaleDateString()}
                            {cred.lastUsedAt && (
                              <> · Last used {new Date(cred.lastUsedAt).toLocaleDateString()}</>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Link
                  href="/admin/security/passkeys"
                  className="text-sm text-primary hover:underline"
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>

          {/* Recovery Codes */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-muted/20 p-3">
                <Key className="h-6 w-6 text-muted" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Recovery Codes</h3>
                <p className="mt-1 text-sm text-muted">
                  {unusedRecoveryCodes.length} of {recoveryCodes.length} codes remaining
                </p>
                {unusedRecoveryCodes.length <= 3 && unusedRecoveryCodes.length > 0 && (
                  <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-500">
                    ⚠️ Running low on recovery codes. Consider regenerating.
                  </p>
                )}
              </div>
              <div>
                <Link
                  href="/admin/security/recovery"
                  className="text-sm text-primary hover:underline"
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>

          {/* Trusted Devices */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-muted/20 p-3">
                <Laptop className="h-6 w-6 text-muted" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Trusted Devices</h3>
                <p className="mt-1 text-sm text-muted">
                  {activeDevices.length === 0
                    ? "No trusted devices"
                    : `${activeDevices.length} trusted device${activeDevices.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div>
                <Link
                  href="/admin/security/devices"
                  className="text-sm text-primary hover:underline"
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>

          {/* Disable 2FA */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="font-semibold text-red-600 dark:text-red-500">Disable Two-Factor Authentication</h3>
            <p className="mt-1 text-sm text-muted">
              This will remove all authenticators, passkeys, and recovery codes. You will need to set up 2FA again if you want to re-enable it.
            </p>
            <DisableTwoFactorButton />
          </div>
        </>
      )}
    </div>
  );
}
