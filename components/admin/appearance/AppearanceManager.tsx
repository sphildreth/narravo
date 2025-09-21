"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";

async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  }
  return data;
}

type AppearanceState = {
  themeDefault: "light" | "dark";
  bannerUrl: string;
  overlayFrom: number;
  overlayVia: number;
  overlayTo: number;
  brightness: number;
};

export default function AppearanceManager({ initial }: { initial: AppearanceState }) {
  const [state, setState] = React.useState<AppearanceState>(initial);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setMessage(null); setError(null);
    try {
      await Promise.all([
        postJSON("/api/admin/config/global", { key: "THEME.DEFAULT", value: state.themeDefault, type: "string", allowedValues: ["light","dark"], required: true }),
        postJSON("/api/admin/config/global", { key: "BANNER.IMAGE.URL", value: state.bannerUrl, type: "string", required: true }),
        postJSON("/api/admin/config/global", { key: "BANNER.OVERLAY.FROM", value: Math.max(0, Math.min(100, Math.round(state.overlayFrom))), type: "number", required: true }),
        postJSON("/api/admin/config/global", { key: "BANNER.OVERLAY.VIA", value: Math.max(0, Math.min(100, Math.round(state.overlayVia))), type: "number", required: true }),
        postJSON("/api/admin/config/global", { key: "BANNER.OVERLAY.TO", value: Math.max(0, Math.min(100, Math.round(state.overlayTo))), type: "number", required: true }),
        postJSON("/api/admin/config/global", { key: "BANNER.BRIGHTNESS", value: Math.max(0, Math.min(100, Math.round(state.brightness))), type: "number", required: true }),
      ]);
      setMessage("Appearance settings saved");
    } catch (e: any) {
      setError(e.message || "Failed to save appearance");
    }
  };

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Theme</h2>
        <div className="flex gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="theme" value="light" className="accent-[var(--brand)]" checked={state.themeDefault === "light"} onChange={() => setState((s) => ({ ...s, themeDefault: "light" }))} />
            Light
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="theme" value="dark" className="accent-[var(--brand)]" checked={state.themeDefault === "dark"} onChange={() => setState((s) => ({ ...s, themeDefault: "dark" }))} />
            Dark
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Banner</h2>
        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-[1fr_160px]">
            <input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" placeholder="Image URL" value={state.bannerUrl} onChange={(e) => setState((s) => ({ ...s, bannerUrl: e.currentTarget.value }))} />
            <a href={state.bannerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-border text-sm hover:bg-muted/20">Open</a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[{k:"overlayFrom", label:"Overlay From"}, {k:"overlayVia", label:"Overlay Via"}, {k:"overlayTo", label:"Overlay To"}].map(({k,label}) => (
              <div key={k} className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted">{label} ({(state as any)[k]}%)</label>
                <input type="range" min={0} max={100} value={(state as any)[k]} onChange={(e) => setState((s) => ({ ...s, [k]: Number(e.currentTarget.value) }))} />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted">Brightness ({state.brightness}%)</label>
            <input type="range" min={0} max={100} value={state.brightness} onChange={(e) => setState((s) => ({ ...s, brightness: Number(e.currentTarget.value) }))} />
          </div>
        </div>
      </section>

      <div>
        <button onClick={save} className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-3 text-sm font-semibold text-brand-contrast">Save Changes</button>
      </div>
    </div>
  );
}

