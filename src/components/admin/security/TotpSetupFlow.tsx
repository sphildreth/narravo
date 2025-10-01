"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function TotpSetupFlow() {
  const [step, setStep] = useState<"init" | "verify" | "codes">("init");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleInit = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/2fa/totp/init", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to initialize TOTP");
        return;
      }

      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("verify");
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/2fa/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Invalid code");
        return;
      }

      const data = await response.json();
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

  const handleFinish = () => {
    router.push("/admin/security");
    router.refresh();
  };

  // Step 1: Initialize
  if (step === "init") {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Step 1: Install an Authenticator App</h2>
        <p className="mt-2 text-sm text-muted">
          You'll need an authenticator app on your phone or computer. We recommend:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">
          <li>Google Authenticator (iOS, Android)</li>
          <li>Authy (iOS, Android, Desktop)</li>
          <li>1Password (iOS, Android, Desktop)</li>
          <li>Microsoft Authenticator (iOS, Android)</li>
        </ul>

        {error && (
          <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
            {error}
          </div>
        )}

        <button
          onClick={handleInit}
          disabled={isLoading}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? "Generating..." : "Continue"}
        </button>
      </div>
    );
  }

  // Step 2: Scan QR and verify
  if (step === "verify") {
    return (
      <form onSubmit={handleVerify} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Step 2: Scan QR Code</h2>
          <p className="mt-2 text-sm text-muted">
            Open your authenticator app and scan this QR code:
          </p>

          {qrCode && (
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg bg-white p-4">
                <Image
                  src={qrCode}
                  alt="TOTP QR Code"
                  width={200}
                  height={200}
                  className="h-auto w-full max-w-[200px]"
                />
              </div>
            </div>
          )}

          <div className="mt-4 rounded-md bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted">Manual entry key:</p>
            <code className="mt-1 block break-all text-sm">{secret}</code>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Step 3: Enter Verification Code</h2>
          <p className="mt-2 text-sm text-muted">
            Enter the 6-digit code from your authenticator app:
          </p>

          <input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="mt-4 w-full rounded-md border border-border bg-bg px-4 py-2 text-center text-2xl tracking-widest"
            autoFocus
          />

          {error && (
            <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || verifyCode.length !== 6}
            className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Verifying..." : "Verify and Enable 2FA"}
          </button>
        </div>
      </form>
    );
  }

  // Step 3: Show recovery codes
  if (step === "codes") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-500">
            ✓ Two-Factor Authentication Enabled
          </h2>
          <p className="mt-2 text-sm text-muted">
            Your account is now protected with two-factor authentication.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Save Your Recovery Codes</h2>
          <p className="mt-2 text-sm text-muted">
            Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
          </p>
          <p className="mt-2 text-sm font-medium text-yellow-600 dark:text-yellow-500">
            ⚠️ Each code can only be used once. These codes will not be shown again.
          </p>

          <div className="mt-4 rounded-md bg-muted/20 p-4 font-mono text-sm">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, index) => (
                <div key={index} className="text-center">
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
              onClick={() => {
                const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "narravo-recovery-codes.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-muted/20"
            >
              Download Codes
            </button>
          </div>

          <button
            onClick={handleFinish}
            className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
