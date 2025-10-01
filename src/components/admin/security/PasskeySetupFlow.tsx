"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Download } from "lucide-react";

export default function PasskeySetupFlow() {
  const [step, setStep] = useState<"register" | "codes">("register");
  const [passkeyName, setPasskeyName] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Step 3: Confirm registration and enable 2FA
      const confirmResponse = await fetch("/api/2fa/webauthn/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...registrationResponse,
          nickname: passkeyName.trim() || undefined,
        }),
      });

      if (!confirmResponse.ok) {
        const data = await confirmResponse.json();
        setError(data.error || "Failed to enable 2FA");
        return;
      }

      const data = await confirmResponse.json();
      setRecoveryCodes(data.recoveryCodes);
      setStep("codes");
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadRecoveryCodes = () => {
    const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "narravo-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFinish = async () => {
    // Update session to reflect 2FA enabled state
    await update({});
    
    // Wait a moment for the session to fully update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    router.push("/admin/security");
    router.refresh();
  };

  // Step 1: Register passkey
  if (step === "register") {
    return (
      <form onSubmit={handleRegister} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Register Your Passkey</h2>
          <p className="mt-2 text-sm text-muted">
            When you click "Register Passkey", your browser or password manager (like Bitwarden) will prompt you to create a passkey using:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Your device's biometrics (Face ID, Touch ID, Windows Hello)</li>
            <li>A security key (YubiKey, etc.)</li>
            <li>Your password manager (Bitwarden, 1Password, etc.)</li>
          </ul>

          <div className="mt-6">
            <label htmlFor="passkey-name" className="block text-sm font-medium">
              Passkey Name (Optional)
            </label>
            <input
              id="passkey-name"
              type="text"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder="e.g., My Laptop, Bitwarden"
              className="mt-2 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">
              Give this passkey a name to identify it later (e.g., "My Laptop" or "Bitwarden")
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Registering..." : "Register Passkey"}
          </button>
        </div>

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <h4 className="mb-2 font-semibold text-sm text-blue-600 dark:text-blue-500">
            💡 Using Bitwarden?
          </h4>
          <p className="text-sm text-muted">
            When you click "Register Passkey", Bitwarden will automatically detect the request and offer to save the passkey. 
            Make sure your Bitwarden extension is unlocked before proceeding.
          </p>
        </div>
      </form>
    );
  }

  // Step 2: Show recovery codes
  if (step === "codes") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-500">
            ✓ Two-Factor Authentication Enabled
          </h2>
          <p className="mt-2 text-sm text-muted">
            Your account is now protected with passkey authentication.
          </p>
        </div>

        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-6">
          <h3 className="font-semibold text-yellow-600 dark:text-yellow-500">
            ⚠️ Save Your Recovery Codes
          </h3>
          <p className="mt-2 text-sm text-muted">
            These codes are your backup if you lose access to your passkey. Save them in a secure location.
            <strong className="block mt-2">You won't be able to see these codes again!</strong>
          </p>

          <div className="mt-4 rounded-md border border-border bg-bg p-4">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="rounded bg-muted/20 p-2 text-center">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCopyRecoveryCodes}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20"
            >
              {copied ? "Copied!" : "Copy Codes"}
            </button>
            <button
              onClick={handleDownloadRecoveryCodes}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-2 font-semibold text-sm">Next Steps</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Consider adding a TOTP authenticator app as a backup method</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>You can add multiple passkeys from different devices</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Manage all your 2FA methods from the Security Settings page</span>
            </li>
          </ul>
        </div>

        <button
          onClick={handleFinish}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90"
        >
          Go to Security Settings
        </button>
      </div>
    );
  }

  return null;
}
