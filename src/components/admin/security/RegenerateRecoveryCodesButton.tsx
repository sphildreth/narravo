"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegenerateRecoveryCodesButtonProps {
  currentCount: number;
}

export default function RegenerateRecoveryCodesButton({ currentCount }: RegenerateRecoveryCodesButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError("");

    try {
      const response = await fetch("/api/2fa/recovery/regenerate", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to regenerate codes");
        return;
      }

      const data = await response.json();
      setNewCodes(data.recoveryCodes);
      setIsConfirming(false);
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([newCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "narravo-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDone = () => {
    setNewCodes([]);
    router.refresh();
  };

  // Show new codes modal
  if (newCodes.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-500">
            ✓ Recovery Codes Regenerated
          </h3>
          <p className="mt-2 text-sm text-muted">
            Your new recovery codes are shown below. Save them immediately — they won't be shown again.
          </p>
          <p className="mt-2 text-sm font-medium text-yellow-600 dark:text-yellow-500">
            ⚠️ All previous recovery codes have been invalidated.
          </p>

          <div className="mt-4 rounded-md bg-muted/20 p-4 font-mono text-sm">
            <div className="grid grid-cols-2 gap-2">
              {newCodes.map((code, index) => (
                <div key={index} className="text-center">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20"
            >
              {copied ? "Copied!" : "Copy Codes"}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20"
            >
              Download Codes
            </button>
          </div>

          <button
            onClick={handleDone}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90"
          >
            I've Saved My Codes
          </button>
        </div>
      </div>
    );
  }

  // Show confirmation modal
  if (isConfirming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <h3 className="text-lg font-semibold">Regenerate Recovery Codes?</h3>
          <p className="mt-2 text-sm text-muted">
            This will generate 10 new recovery codes and invalidate all {currentCount} existing codes.
          </p>
          <p className="mt-2 text-sm font-medium text-yellow-600 dark:text-yellow-500">
            Make sure to save the new codes immediately!
          </p>

          {error && (
            <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => {
                setIsConfirming(false);
                setError("");
              }}
              disabled={isRegenerating}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
            >
              {isRegenerating ? "Generating..." : "Regenerate Codes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show regenerate button
  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90"
    >
      {currentCount === 0 ? "Generate New Recovery Codes" : "Regenerate Recovery Codes"}
    </button>
  );
}
