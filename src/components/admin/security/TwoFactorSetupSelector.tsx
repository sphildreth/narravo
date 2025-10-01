"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { Smartphone, Fingerprint } from "lucide-react";
import TotpSetupFlow from "./TotpSetupFlow";
import PasskeySetupFlow from "./PasskeySetupFlow";

type SetupMethod = "select" | "totp" | "passkey";

export default function TwoFactorSetupSelector() {
  const [method, setMethod] = useState<SetupMethod>("select");

  if (method === "totp") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setMethod("select")}
          className="text-sm text-muted hover:text-fg"
        >
          ← Back to method selection
        </button>
        <TotpSetupFlow />
      </div>
    );
  }

  if (method === "passkey") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setMethod("select")}
          className="text-sm text-muted hover:text-fg"
        >
          ← Back to method selection
        </button>
        <PasskeySetupFlow />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Passkey Option - Recommended */}
        <button
          onClick={() => setMethod("passkey")}
          className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:bg-card/80"
        >
          <div className="absolute right-4 top-4">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Recommended
            </span>
          </div>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Passkey (WebAuthn)</h3>
          <p className="text-sm text-muted">
            Use your device's biometrics, security key, or password manager (like Bitwarden) for phishing-resistant authentication.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Most secure option
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Phishing-resistant
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Quick & convenient
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Works with Bitwarden
            </li>
          </ul>
        </button>

        {/* TOTP Option */}
        <button
          onClick={() => setMethod("totp")}
          className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:bg-card/80"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted/20">
            <Smartphone className="h-6 w-6 text-muted" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Authenticator App (TOTP)</h3>
          <p className="text-sm text-muted">
            Use an authenticator app like Google Authenticator, Authy, or 1Password to generate time-based codes.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Works on any device
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Widely supported
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Works offline
            </li>
          </ul>
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-2 font-semibold text-sm">💡 Tip</h4>
        <p className="text-sm text-muted">
          You can add additional authentication methods after completing the initial setup. 
          We recommend setting up both a passkey and an authenticator app for redundancy.
        </p>
      </div>
    </div>
  );
}
