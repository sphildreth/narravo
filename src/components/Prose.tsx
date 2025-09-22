// SPDX-License-Identifier: Apache-2.0

/**
 * components/Prose.tsx
 * Lightweight HTML renderer with a consistent typographic wrapper.
 */
import React from "react";

export default function Prose({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={["prose prose-neutral dark:prose-invert max-w-none", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}
