"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RevokeAllDevicesButton() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const router = useRouter();

  const handleRevokeAll = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch("/api/2fa/trusted-devices", {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to revoke all devices:", err);
    } finally {
      setIsRevoking(false);
      setIsConfirming(false);
    }
  };

  if (isConfirming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <h3 className="text-lg font-semibold">Revoke All Trusted Devices?</h3>
          <p className="mt-2 text-sm text-muted">
            This will revoke trust from all devices. You'll need to complete 2FA verification on every device the next time you log in.
          </p>

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setIsConfirming(false)}
              disabled={isRevoking}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRevokeAll}
              disabled={isRevoking}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isRevoking ? "Revoking..." : "Revoke All"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="rounded-md border border-red-600 bg-red-600/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-600/20"
    >
      Revoke All Devices
    </button>
  );
}
