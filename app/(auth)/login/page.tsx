// SPDX-License-Identifier: Apache-2.0
import { authEnabledProviders } from "@/lib/auth";
import ProviderButtons from "@/components/auth/ProviderButtons";

export default function Login() {
  const providers = authEnabledProviders;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-fg">Sign in to Narravo</h1>
        <p className="text-sm text-muted">Choose a provider to continue.</p>
      </header>

      {providers.length > 0 ? (
        <ProviderButtons providers={providers} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-card-fg">
          No OAuth providers are configured. Set GITHUB_ID/GITHUB_SECRET and/or GOOGLE_ID/GOOGLE_SECRET in your environment.
        </div>
      )}

      <footer className="text-center text-xs text-muted">
        We never post on your behalf. Signing in lets you join the discussion.
      </footer>
    </main>
  );
}
