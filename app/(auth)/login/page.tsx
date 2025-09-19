"use client";

import { signIn } from "next-auth/react";

const providers = [
  { id: "github", label: "Continue with GitHub" },
  { id: "google", label: "Continue with Google" },
];

export default function Login() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-fg">Sign in to Narravo</h1>
        <p className="text-sm text-muted">Use your GitHub or Google account to comment and react.</p>
      </header>

      <div className="space-y-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => signIn(provider.id, { callbackUrl: "/" })}
            className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-fg shadow-soft transition-colors hover:bg-brand hover:text-brand-contrast"
          >
            {provider.label}
          </button>
        ))}
      </div>

      <footer className="text-center text-xs text-muted">
        We never post on your behalf. Signing in lets you join the discussion.
      </footer>
    </main>
  );
}
