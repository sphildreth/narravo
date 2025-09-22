"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { useRouter } from "next/navigation";

async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  }
  return data;
}

type AboutMeState = {
  enabled: boolean;
  title: string;
  content: string;
};

export default function AboutMeManager({ initial }: { initial: AboutMeState }) {
  const router = useRouter();
  const [state, setState] = React.useState<AboutMeState>(initial);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setMessage(null); setError(null);
    try {
      await Promise.all([
        postJSON("/api/admin/config/global", { key: "SITE.ABOUT-ME.ENABLED", value: state.enabled, type: "boolean", required: true }),
        postJSON("/api/admin/config/global", { key: "SITE.ABOUT-ME.TITLE", value: state.title, type: "string", required: true }),
        postJSON("/api/admin/config/global", { key: "SITE.ABOUT-ME.CONTENT", value: state.content, type: "string", required: true }),
      ]);
      setMessage("About Me settings saved");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to save About Me settings");
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">About Me</h2>
        
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              className="accent-[var(--brand)]" 
              checked={state.enabled} 
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setState((s) => ({ ...s, enabled: checked }));
              }}
            />
            Enable About Me section
          </label>
        </div>
        
        {state.enabled && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wide text-muted">Title</label>
              <input 
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" 
                placeholder="About Me" 
                value={state.title} 
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setState((s) => ({ ...s, title: v }));
                }}
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wide text-muted">Content</label>
              <textarea 
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" 
                placeholder="Write something about yourself..." 
                value={state.content}
                rows={5}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setState((s) => ({ ...s, content: v }));
                }}
              />
            </div>
          </div>
        )}
      </section>

      <div>
        <button onClick={save} className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-3 text-sm font-semibold text-brand-contrast">Save Changes</button>
      </div>
    </div>
  );
}