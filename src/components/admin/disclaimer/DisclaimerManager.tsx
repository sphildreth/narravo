"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { useRouter } from "next/navigation";
import TiptapEditor from "@/components/editor/TiptapEditor";
import { markdownToHtmlSync } from "@/lib/markdown";
import TurndownService from "turndown";

async function postJSON(path: string, body: any) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${res.status}`);
  }
  return data;
}

type DisclaimerState = {
  enabled: boolean;
  text: string;
  style: string;
};

export default function DisclaimerManager({ initial }: { initial: DisclaimerState }) {
  const router = useRouter();
  const turndownService = new TurndownService();
  const [state, setState] = React.useState({ ...initial, markdown: turndownService.turndown(initial.text) });
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setMessage(null); setError(null);
    try {
      const html = markdownToHtmlSync(state.markdown);
      await Promise.all([
        postJSON("/api/admin/config/global", { key: "SITE.DISCLAIMER.ENABLED", value: state.enabled, type: "boolean", required: true }),
        postJSON("/api/admin/config/global", { key: "SITE.DISCLAIMER.TEXT", value: html, type: "string", required: true }),
        postJSON("/api/admin/config/global", { key: "SITE.DISCLAIMER.STYLE", value: state.style, type: "string", required: false }),
      ]);
      setMessage("Disclaimer settings saved");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to save Disclaimer settings");
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Disclaimer</h2>
        
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
            Enable Disclaimer section
          </label>
        </div>
        
        {state.enabled && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wide text-muted">Text</label>
              <TiptapEditor
                initialMarkdown={state.markdown}
                onChange={(markdown) => {
                  setState((s) => ({ ...s, markdown }));
                }}
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wide text-muted">Style</label>
              <textarea 
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" 
                placeholder="Enter custom CSS styles here..." 
                value={state.style}
                rows={5}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setState((s) => ({ ...s, style: v }));
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