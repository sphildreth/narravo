"use client";
// SPDX-License-Identifier: Apache-2.0
import { signIn } from "next-auth/react";

export default function ProviderButtons({ providers }: { providers: { id: string; label: string }[] }) {
  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => signIn(provider.id, { callbackUrl: "/" })}
          className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-fg shadow-soft transition-colors hover:bg-brand hover:text-brand-contrast"
        >
          Continue with {provider.label}
        </button>
      ))}
    </div>
  );
}

