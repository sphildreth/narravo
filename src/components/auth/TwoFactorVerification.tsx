"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { Shield, Smartphone, Key } from "lucide-react";
import { useSession } from "next-auth/react";

type VerificationMethod = "totp" | "webauthn" | "recovery";

export default function TwoFactorVerification() {
  const [method, setMethod] = useState<VerificationMethod>("totp");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { update } = useSession();

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/2fa/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code, 
          rememberDevice 
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Invalid code");
        return;
      }

      console.log("[2FA] TOTP verification successful, updating session...");
      
      // Trigger session update to refresh mfa status
      // Pass empty object to force token refresh
      await update({});
      
      console.log("[2FA] Session updated, waiting for token refresh...");
      
      // Wait a moment for the session to fully update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("[2FA] Redirecting to home...");

      // Success! Redirect to home
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[2FA] TOTP verification error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleWebAuthnVerify = async () => {
    setIsVerifying(true);
    setError("");

    try {
      // Step 1: Get authentication options
      const optionsResponse = await fetch("/api/2fa/webauthn/authenticate/options", {
        method: "POST",
      });

      if (!optionsResponse.ok) {
        const data = await optionsResponse.json();
        setError(data.error || "Failed to start authentication");
        return;
      }

      const options = await optionsResponse.json();

      // Step 2: Start WebAuthn authentication
      let authResponse;
      try {
        authResponse = await startAuthentication(options);
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          setError("Authentication was cancelled or timed out");
        } else {
          setError("Authentication failed. Please try again.");
        }
        return;
      }

      // Step 3: Verify authentication with server
      const verifyResponse = await fetch("/api/2fa/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...authResponse,
          rememberDevice 
        }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        setError(data.error || "Failed to verify authentication");
        return;
      }

      console.log("[2FA] WebAuthn verification successful, updating session...");
      
      // Trigger session update to refresh mfa status
      await update({});
      
      console.log("[2FA] Session updated, waiting for token refresh...");
      
      // Wait a moment for the session to fully update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("[2FA] Redirecting to home...");

      // Success! Redirect to home
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[2FA] WebAuthn verification error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/2fa/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: recoveryCode,
          rememberDevice 
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Invalid recovery code");
        return;
      }

      console.log("[2FA] Recovery code verification successful, updating session...");
      
      // Trigger session update to refresh mfa status
      await update({});
      
      console.log("[2FA] Session updated, waiting for token refresh...");
      
      // Wait a moment for the session to fully update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("[2FA] Redirecting to home...");

      // Success! Redirect to home
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[2FA] Recovery code verification error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Method tabs */}
      <div className="flex gap-2 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => {
            setMethod("totp");
            setError("");
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            method === "totp"
              ? "bg-primary text-primary-fg"
              : "text-muted hover:bg-muted/20"
          }`}
        >
          <Smartphone className="mx-auto mb-1 h-5 w-5" />
          Authenticator
        </button>
        <button
          onClick={() => {
            setMethod("webauthn");
            setError("");
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            method === "webauthn"
              ? "bg-primary text-primary-fg"
              : "text-muted hover:bg-muted/20"
          }`}
        >
          <Key className="mx-auto mb-1 h-5 w-5" />
          Passkey
        </button>
        <button
          onClick={() => {
            setMethod("recovery");
            setError("");
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            method === "recovery"
              ? "bg-primary text-primary-fg"
              : "text-muted hover:bg-muted/20"
          }`}
        >
          <Shield className="mx-auto mb-1 h-5 w-5" />
          Recovery
        </button>
      </div>

      {/* Verification forms */}
      <div className="rounded-lg border border-border bg-card p-6">
        {method === "totp" && (
          <form onSubmit={handleTotpVerify} className="space-y-4">
            <div>
              <label htmlFor="totp-code" className="mb-2 block text-sm font-medium">
                Authenticator Code
              </label>
              <input
                id="totp-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full rounded-md border border-border bg-bg px-4 py-3 text-center text-2xl tracking-widest"
                autoFocus
                autoComplete="off"
              />
              <p className="mt-2 text-xs text-muted">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember-device"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="remember-device" className="text-sm text-muted">
                Remember this device for 30 days
              </label>
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
            >
              {isVerifying ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        {method === "webauthn" && (
          <div className="space-y-4">
            <div className="text-center">
              <Key className="mx-auto h-12 w-12 text-muted" />
              <p className="mt-4 text-sm text-muted">
                Use your passkey (biometrics or security key) to verify your identity
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember-device-webauthn"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="remember-device-webauthn" className="text-sm text-muted">
                Remember this device for 30 days
              </label>
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
                {error}
              </div>
            )}

            <button
              onClick={handleWebAuthnVerify}
              disabled={isVerifying}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
            >
              {isVerifying ? "Authenticating..." : "Authenticate with Passkey"}
            </button>
          </div>
        )}

        {method === "recovery" && (
          <form onSubmit={handleRecoveryVerify} className="space-y-4">
            <div>
              <label htmlFor="recovery-code" className="mb-2 block text-sm font-medium">
                Recovery Code
              </label>
              <input
                id="recovery-code"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.trim())}
                placeholder="xxxx-xxxx-xxxx"
                className="w-full rounded-md border border-border bg-bg px-4 py-3 font-mono"
                autoFocus
                autoComplete="off"
              />
              <p className="mt-2 text-xs text-muted">
                Enter one of your recovery codes (each code can only be used once)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember-device-recovery"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="remember-device-recovery" className="text-sm text-muted">
                Remember this device for 30 days
              </label>
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !recoveryCode}
              className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-fg hover:bg-primary/90 disabled:opacity-50"
            >
              {isVerifying ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-center">
        <p className="text-xs text-muted">
          Lost access to your authenticator? Use a recovery code or passkey instead.
        </p>
      </div>
    </div>
  );
}
