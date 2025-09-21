"use client";
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  const hint = (
    <div className="mt-4 text-sm opacity-80">
      <p>If this is a fresh setup, ensure the database is running and seed required configuration:</p>
      <pre className="bg-gray-100 text-gray-800 p-3 rounded mt-2 overflow-auto">
        <code>
{`docker compose up -d db
pnpm drizzle:push
pnpm seed:config`}
        </code>
      </pre>
    </div>
  );

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2">{error.message || "Unexpected error"}</p>
      {hint}
      <button
        className="mt-6 inline-flex items-center rounded bg-black text-white px-4 py-2 hover:opacity-90"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  );
}

