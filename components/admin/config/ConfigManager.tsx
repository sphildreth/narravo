"use client";
import * as React from "react";
import type { ConfigType } from "@/lib/config";

type Item = {
  key: string;
  type: ConfigType;
  value: any;
  allowedValues: any[] | null;
  required: boolean;
};

const TYPES: ConfigType[] = ["string", "integer", "number", "boolean", "date", "datetime", "json"];

function coerceToType(raw: any, type: ConfigType): any {
  try {
    switch (type) {
      case "string":
        return String(raw ?? "");
      case "integer":
        return Number.parseInt(String(raw ?? ""), 10);
      case "number":
        return Number(String(raw ?? ""));
      case "boolean":
        if (typeof raw === "boolean") return raw;
        return String(raw).toLowerCase() === "true";
      case "date":
      case "datetime":
        return String(raw ?? "");
      case "json":
        if (typeof raw === "string") return JSON.parse(raw || "null");
        return raw;
    }
  } catch {
    return raw;
  }
}

function ValueInput({ type, value, onChange }: { type: ConfigType; value: any; onChange: (v: any) => void }) {
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

async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  }
  return data;
}

export default function ConfigManager({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = React.useState<Item[]>(initialItems);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [newKey, setNewKey] = React.useState("");
  const [newType, setNewType] = React.useState<ConfigType>("string");
  const [newValue, setNewValue] = React.useState<any>("");
  const [newRequired, setNewRequired] = React.useState(false);
  const [newAllowed, setNewAllowed] = React.useState<string>("");

  const saveExisting = async (entry: Item) => {
    setMessage(null); setError(null);
    try {
      const body: any = { key: entry.key, value: coerceToType(entry.value, entry.type) };
      await postJSON("/api/admin/config/global", body);
      setMessage(`Saved ${entry.key}`);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    }
  };

  const invalidate = async (key: string) => {
    setMessage(null); setError(null);
    try {
      await postJSON("/api/admin/config/invalidate", { key });
      setMessage(`Invalidated cache for ${key}`);
    } catch (e: any) {
      setError(e.message || "Failed to invalidate");
    }
  };

  const createNew = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(null); setError(null);
    try {
      const value = coerceToType(newValue, newType);
      const allowedValues = newAllowed.trim() ? JSON.parse(newAllowed) : null;
      await postJSON("/api/admin/config/global", { key: newKey, type: newType, value, allowedValues, required: newRequired });
      setItems((prev) => [...prev, { key: newKey, type: newType, value, allowedValues, required: newRequired }]);
      setNewKey(""); setNewType("string"); setNewValue(""); setNewRequired(false); setNewAllowed("");
      setMessage(`Created ${newKey}`);
    } catch (e: any) {
      setError(e.message || "Failed to create");
    }
  };

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Existing keys</h2>
        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.key} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-muted">{it.type.toUpperCase()}</div>
                  <div className="truncate font-semibold">{it.key}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => invalidate(it.key)} className="inline-flex items-center h-9 rounded-lg border border-border px-3 text-sm">Invalidate</button>
                  <button onClick={() => saveExisting(it)} className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-3 text-sm font-semibold text-brand-contrast">Save</button>
                </div>
              </div>
              <div className="mt-3">
                <ValueInput type={it.type} value={it.value} onChange={(v) => setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, value: v } : p)))} />
              </div>
              {it.allowedValues && (
                <div className="mt-2 text-xs text-muted">Allowed: <span className="font-mono">{JSON.stringify(it.allowedValues)}</span></div>
              )}
              {it.required && (
                <div className="text-xs text-muted">Required</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Create new key</h2>
        <form onSubmit={createNew} className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" placeholder="UPPERCASE.DOT.NOTATION" value={newKey} onChange={(e) => setNewKey(e.currentTarget.value)} required />
            <select className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" value={newType} onChange={(e) => setNewType(e.currentTarget.value as ConfigType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <ValueInput type={newType} value={newValue} onChange={setNewValue} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--brand)]" checked={newRequired} onChange={(e) => setNewRequired(e.currentTarget.checked)} />
              Required
            </label>
            <div>
              <input className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono" placeholder='Allowed values (JSON array), e.g. ["light","dark"]' value={newAllowed} onChange={(e) => setNewAllowed(e.currentTarget.value)} />
            </div>
          </div>
          <div>
            <button type="submit" className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-3 text-sm font-semibold text-brand-contrast">Create</button>
          </div>
        </form>
      </section>
    </div>
  );
}

