"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import type { ConfigType } from "@/lib/config";
import { ValueInput } from "./ValueInput";
import { coerceToType } from "./util";
import { TYPES } from "./constants";
import type { ConfigItem } from "./types";

async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  }
  return data;
}

export function CreateConfigForm({ onCreate }: { onCreate: (item: ConfigItem) => void }) {
  const [key, setKey] = React.useState("");
  const [type, setType] = React.useState<ConfigType>("string");
  const [value, setValue] = React.useState<any>("");
  const [required, setRequired] = React.useState(false);
  const [allowed, setAllowed] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const coercedValue = coerceToType(value, type);
      const allowedValues = allowed.trim() ? JSON.parse(allowed) : null;
      const newItem: ConfigItem = { key, type, value: coercedValue, allowedValues, required };
      await postJSON("/api/admin/config/global", newItem);
      onCreate(newItem);
    } catch (e: any) {
      setError(e.message || "Failed to create");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Create New Configuration Key</h2>
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-[1fr_200px]">
        <input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" placeholder="UPPERCASE.DOT.NOTATION" value={key} onChange={(e) => setKey(e.currentTarget.value)} required />
        <select className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.currentTarget.value as ConfigType)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <ValueInput type={type} value={value} onChange={setValue} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[var(--brand)]" checked={required} onChange={(e) => setRequired(e.currentTarget.checked)} />
          Required
        </label>
        <div>
          <input className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono" placeholder='Allowed values (JSON array), e.g. ["light","dark"]' value={allowed} onChange={(e) => setAllowed(e.currentTarget.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-4 text-sm font-semibold text-brand-contrast">Create</button>
      </div>
    </form>
  );
}
