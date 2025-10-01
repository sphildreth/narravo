"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisableTwoFactorButton() {
  const [isDisabling, setIsDisabling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleDisable = async () => {
    setIsDisabling(true);
    try {
      const response = await fetch("/api/2fa/disable", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to disable 2FA");
        return;
      }

      alert("Two-factor authentication has been disabled.");
      router.refresh();
    } catch (error) {
      alert("An error occurred while disabling 2FA");
    } finally {
      setIsDisabling(false);
      setShowConfirm(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="mt-4 rounded-md border border-red-500 bg-transparent px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-500"
      >
        Disable 2FA
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-red-600 dark:text-red-500">
        Are you sure? This action cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDisable}
          disabled={isDisabling}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDisabling ? "Disabling..." : "Yes, Disable 2FA"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium hover:bg-muted/20"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
