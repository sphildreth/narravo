"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import type { ConfigItem } from "./types";
import { ValueInput } from "./ValueInput";
import { coerceToType } from "./util";

async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  }
  return data;
}

export function ConfigCard({ item, onUpdate, onDelete }: { item: ConfigItem, onUpdate: (item: ConfigItem) => void, onDelete: (key: string) => void }) {
  const [value, setValue] = React.useState(item.value);
  const [required, setRequired] = React.useState(item.required);
  const [isEditing, setIsEditing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setMessage(null); setError(null);
    try {
      const coercedValue = coerceToType(value, item.type);
      await postJSON("/api/admin/config/global", { key: item.key, value: coercedValue, required });
      onUpdate({ ...item, value: coercedValue, required });
      setIsEditing(false);
      setMessage(`Saved ${item.key}`);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    }
  };

  

  const remove = async () => {
    setMessage(null); setError(null);
    if (window.confirm(`Are you sure you want to delete ${item.key}?`)) {
      try {
        await postJSON("/api/admin/config/delete", { key: item.key });
        onDelete(item.key);
        setMessage(`Deleted ${item.key}`);
      } catch (e: any) {
        setError(e.message || "Failed to delete");
      }
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-mono text-muted">{item.type.toUpperCase()}</div>
          <div className="truncate font-semibold">{item.key}</div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="inline-flex items-center h-9 rounded-lg border border-border px-3 text-sm">Cancel</button>
              <button onClick={save} className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-3 text-sm font-semibold text-brand-contrast">Save</button>
            </>
          ) : (
            <>
              
              <button onClick={() => setIsEditing(true)} className="inline-flex items-center h-9 rounded-lg border border-border px-3 text-sm">Edit</button>
              {!item.required && (
                <button onClick={remove} className="inline-flex items-center h-9 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-sm text-red-200">Delete</button>
              )}
            </>
          )}
        </div>
      </div>
      {isEditing && (
        <div className="mt-3 space-y-3">
          <ValueInput type={item.type} value={value} onChange={setValue} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--brand)]" checked={required} onChange={(e) => setRequired(e.currentTarget.checked)} />
            Required
          </label>
        </div>
      )}
      {item.allowedValues && (
        <div className="mt-2 text-xs text-muted">Allowed: <span className="font-mono">{JSON.stringify(item.allowedValues)}</span></div>
      )}
      {item.required && (
        <div className="mt-2 text-xs text-muted font-semibold text-amber-400">Required</div>
      )}
      {(message || error) && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}
    </div>
  );
}