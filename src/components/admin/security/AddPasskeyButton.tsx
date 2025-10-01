"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

export default function AddPasskeyButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const router = useRouter();

  const handleAddPasskey = async () => {
    setShowNamePrompt(true);
  };

  const handleConfirmAdd = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Step 1: Get registration options from server
      const optionsResponse = await fetch("/api/2fa/webauthn/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: passkeyName.trim() || undefined }),
      });

      if (!optionsResponse.ok) {
        const data = await optionsResponse.json();
        setError(data.error || "Failed to start registration");
        return;
      }

      const options = await optionsResponse.json();

      // Step 2: Start WebAuthn registration flow
      let registrationResponse;
      try {
        registrationResponse = await startRegistration(options);
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          setError("Registration was cancelled or timed out");
        } else {
          setError("WebAuthn registration failed. Your device may not support passkeys.");
        }
        return;
      }

      // Step 3: Verify registration with server
      const verifyResponse = await fetch("/api/2fa/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...registrationResponse,
          nickname: passkeyName.trim() || undefined,
        }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        setError(data.error || "Failed to verify registration");
        return;
      }

      // Success! Refresh the page to show the new passkey
      setShowNamePrompt(false);
      setPasskeyName("");
      router.refresh();
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showNamePrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <h3 className="text-lg font-semibold">Add Passkey</h3>
          <p className="mt-2 text-sm text-muted">
            Give this passkey a name to help you identify it later (optional).
          </p>

          <input
            type="text"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            placeholder="My MacBook Pro, iPhone 15, YubiKey, etc."
            className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            autoFocus
          />

          {error && (
            <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => {
                setShowNamePrompt(false);
                setPasskeyName("");
                setError("");
              }}
              disabled={isLoading}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAdd}
              disabled={isLoading}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Registering..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleAddPasskey}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90"
    >
      Add Passkey
    </button>
  );
}
