"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Method = "totp" | "webauthn" | "recovery";

export default function DisableTwoFactorButton() {
  const [isDisabling, setIsDisabling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [method, setMethod] = useState<Method>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { update } = useSession();

  const handleDisable = async () => {
    setIsDisabling(true);
    setError(null);
    try {
      let payload: object;
      if (method === "webauthn") {
        const optionsResponse = await fetch("/api/2fa/step-up/webauthn/options", { method: "POST" });
        const options = await optionsResponse.json();
        if (!optionsResponse.ok) throw new Error(options.error || "Failed to start passkey verification");
        payload = { method, response: await startAuthentication({ optionsJSON: options }) };
      } else {
        payload = { method, code: code.trim() };
      }

      const response = await fetch("/api/2fa/disable", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to disable 2FA");

      await update({});
      router.refresh();
      setShowConfirm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to disable 2FA");
    } finally {
      setIsDisabling(false);
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
    <div className="mt-4 max-w-md space-y-3 rounded-md border border-red-500/40 p-4">
      <p className="text-sm font-medium text-red-600 dark:text-red-500">
        Verify a current second factor before disabling 2FA.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Verification method">
        {(["totp", "webauthn", "recovery"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => { setMethod(value); setCode(""); setError(null); }}
            className={`rounded-md border px-3 py-1.5 text-sm ${method === value ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {value === "totp" ? "Authenticator" : value === "webauthn" ? "Passkey" : "Recovery code"}
          </button>
        ))}
      </div>
      {method !== "webauthn" && (
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode={method === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          placeholder={method === "totp" ? "6-digit code" : "XXXX-XXXX"}
          aria-label={method === "totp" ? "Authenticator code" : "Recovery code"}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDisable}
          disabled={isDisabling || (method !== "webauthn" && !code.trim())}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isDisabling ? "Verifying..." : "Verify and disable"}
        </button>
        <button
          onClick={() => { setShowConfirm(false); setError(null); setCode(""); }}
          disabled={isDisabling}
          className="rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium hover:bg-muted/20 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
