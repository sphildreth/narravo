// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustedDevice } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Monitor } from "lucide-react";
import DeleteTrustedDeviceButton from "@/components/admin/security/DeleteTrustedDeviceButton";
import RevokeAllDevicesButton from "@/components/admin/security/RevokeAllDevicesButton";

export default async function TrustedDevicesPage() {
  const session = await requireAdmin2FA();

  // Fetch all trusted devices
  const devices = await db
    .select()
    .from(trustedDevice)
    .where(eq(trustedDevice.userId, session.user!.id))
    .orderBy(desc(trustedDevice.lastSeenAt));

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
        <h1 className="text-2xl font-bold">Trusted Devices</h1>
        <p className="mt-2 text-muted">
          Devices that you've chosen to remember won't require 2FA verification for 30 days.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Active Trusted Devices</h2>
              <p className="text-sm text-muted">
                {devices.length === 0 ? "No trusted devices" : `${devices.length} ${devices.length === 1 ? "device" : "devices"} trusted`}
              </p>
            </div>
          </div>
          {devices.length > 0 && <RevokeAllDevicesButton />}
        </div>

        {devices.length > 0 && (
          <div className="mt-6 space-y-3">
            {devices.map((device: typeof trustedDevice.$inferSelect) => {
              const isExpired = device.expiresAt && new Date(device.expiresAt) < new Date();
              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between rounded-md border border-border bg-bg p-4 ${isExpired ? "opacity-50" : ""}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{device.userAgent || "Unknown Device"}</div>
                      {isExpired && (
                        <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      IP: {device.ipHash ? `${device.ipHash.slice(0, 8)}...` : "Unknown"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Added: {device.createdAt ? new Date(device.createdAt).toLocaleString() : "Unknown"}
                    </div>
                    {device.lastSeenAt && (
                      <div className="mt-1 text-xs text-muted">
                        Last seen: {new Date(device.lastSeenAt).toLocaleString()}
                      </div>
                    )}
                    {device.expiresAt && !isExpired && (
                      <div className="mt-1 text-xs text-muted">
                        Expires: {new Date(device.expiresAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <DeleteTrustedDeviceButton deviceId={device.id} />
                </div>
              );
            })}
          </div>
        )}

        {devices.length === 0 && (
          <div className="mt-6 rounded-md border border-dashed border-border bg-muted/10 p-8 text-center">
            <Monitor className="mx-auto h-12 w-12 text-muted" />
            <p className="mt-3 text-sm text-muted">
              No trusted devices yet. Check "Remember this device" when logging in with 2FA to skip verification for 30 days.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
        <h3 className="text-sm font-medium text-blue-600 dark:text-blue-500">
          About Trusted Devices
        </h3>
        <p className="mt-2 text-xs text-muted">
          When you select "Remember this device" during 2FA login, that device will be trusted for 30 days. 
          You won't need to enter a verification code on trusted devices. Revoke devices if you no longer use them or suspect unauthorized access.
        </p>
      </div>
    </div>
  );
}
