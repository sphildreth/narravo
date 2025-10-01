"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeletePasskeyButtonProps {
  passkeyId: string;
  passkeyName: string | null;
}

export default function DeletePasskeyButton({ passkeyId, passkeyName }: DeletePasskeyButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/2fa/webauthn/credentials/${encodeURIComponent(passkeyId)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      // Error handling could be improved
      console.error("Failed to delete passkey:", err);
    } finally {
      setIsDeleting(false);
      setIsConfirming(false);
    }
  };

  if (isConfirming) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setIsConfirming(false)}
          disabled={isDeleting}
          className="rounded-md border border-border bg-bg px-3 py-1 text-xs font-medium hover:bg-muted/20 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "Deleting..." : "Confirm Delete"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
      title={`Delete ${passkeyName || "this passkey"}`}
    >
      <Trash2 className="h-3 w-3" />
      Delete
    </button>
  );
}
