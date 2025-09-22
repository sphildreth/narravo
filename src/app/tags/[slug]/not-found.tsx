// SPDX-License-Identifier: Apache-2.0

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="max-w-screen mx-auto px-6 my-7">
      <div className="text-center py-12">
        <h1 className="text-4xl font-extrabold text-fg mb-4">Tag Not Found</h1>
        <p className="text-lg text-muted mb-6">
          The tag you're looking for doesn't exist.
        </p>
        <Link 
          href="/" 
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}