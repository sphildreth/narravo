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
  bannerEnabled: boolean;
  bannerImageUrl: string;
  bannerAlt: string;
  bannerCredit: string;
  bannerOverlay: number;
  bannerFocalX: number;
  bannerFocalY: number;
};

export default function AppearanceManager({ initial }: { initial: AppearanceState }) {
  const [state, setState] = React.useState<AppearanceState>(initial);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setMessage(null); setError(null);
    try {
      await Promise.all([
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.ENABLED", value: state.bannerEnabled, type: "boolean", required: true }),
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.IMAGE-URL", value: state.bannerImageUrl, type: "string", required: true }),
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.ALT", value: state.bannerAlt, type: "string", required: true }),
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.CREDIT", value: state.bannerCredit, type: "string", required: true }),
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.OVERLAY", value: Math.max(0, Math.min(1, state.bannerOverlay)), type: "number", required: true }),
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.FOCAL-X", value: Math.max(0, Math.min(1, state.bannerFocalX)), type: "number", required: true }),
        postJSON("/api/admin/config/global", { key: "APPEARANCE.BANNER.FOCAL-Y", value: Math.max(0, Math.min(1, state.bannerFocalY)), type: "number", required: true }),
      ]);
      setMessage("Banner settings saved");
    } catch (e: any) {
      setError(e.message || "Failed to save banner settings");
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Banner</h2>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              className="accent-[var(--brand)]" 
              checked={state.bannerEnabled} 
              onChange={(e) => setState((s) => ({ ...s, bannerEnabled: e.currentTarget.checked }))} 
            />
            Enable banner
          </label>
        </div>
        
        {state.bannerEnabled && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wide text-muted">Image URL</label>
              <input 
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" 
                placeholder="https://example.com/banner.jpg" 
                value={state.bannerImageUrl} 
                onChange={(e) => setState((s) => ({ ...s, bannerImageUrl: e.currentTarget.value }))} 
              />
            </div>
            
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-wide text-muted">Alt Text</label>
                <input 
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" 
                  placeholder="Alt text for banner image" 
                  value={state.bannerAlt} 
                  onChange={(e) => setState((s) => ({ ...s, bannerAlt: e.currentTarget.value }))} 
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-wide text-muted">Credit</label>
                <input 
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" 
                  placeholder="Photo credit" 
                  value={state.bannerCredit} 
                  onChange={(e) => setState((s) => ({ ...s, bannerCredit: e.currentTarget.value }))} 
                />
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted">
                  Overlay Opacity ({Math.round(state.bannerOverlay * 100)}%)
                </label>
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.01} 
                  value={state.bannerOverlay} 
                  onChange={(e) => setState((s) => ({ ...s, bannerOverlay: Number(e.currentTarget.value) }))} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted">
                  Focal X ({Math.round(state.bannerFocalX * 100)}%)
                </label>
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.01} 
                  value={state.bannerFocalX} 
                  onChange={(e) => setState((s) => ({ ...s, bannerFocalX: Number(e.currentTarget.value) }))} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted">
                  Focal Y ({Math.round(state.bannerFocalY * 100)}%)
                </label>
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.01} 
                  value={state.bannerFocalY} 
                  onChange={(e) => setState((s) => ({ ...s, bannerFocalY: Number(e.currentTarget.value) }))} 
                />
              </div>
            </div>
            
            {state.bannerImageUrl && (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted">Preview</label>
                <div className="relative max-w-md h-32 rounded-lg overflow-hidden border border-border">
                  <img 
                    src={state.bannerImageUrl} 
                    alt={state.bannerAlt}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${state.bannerFocalX * 100}% ${state.bannerFocalY * 100}%`
                    }}
                  />
                  <div 
                    className="absolute inset-0 bg-black"
                    style={{ opacity: state.bannerOverlay }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div>
        <button onClick={save} className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-3 text-sm font-semibold text-brand-contrast">Save Changes</button>
      </div>
    </div>
  );
}

