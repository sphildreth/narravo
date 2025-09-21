"use client";
// SPDX-License-Identifier: Apache-2.0
import type { ConfigType } from "@/lib/config";

export function ValueInput({ type, value, onChange }: { type: ConfigType; value: any; onChange: (v: any) => void }) {
  if (type === "boolean") {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[var(--brand)]" checked={Boolean(value)} onChange={(e) => onChange(e.currentTarget.checked)} />
        <span>Enabled</span>
      </label>
    );
  }
  if (type === "json") {
    return (
      <textarea
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono"
        rows={4}
        value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  }
  return (
    <input
      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
      value={typeof value === "string" ? value : String(value ?? "")}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
