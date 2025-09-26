// SPDX-License-Identifier: Apache-2.0
"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Eye } from "lucide-react";

export function PurgeSection() {
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any>(null);
  const [purgeType, setPurgeType] = useState<"post" | "comment">("post");
  const [purgeMode, setPurgeMode] = useState<"soft" | "hard">("soft");
  const [targetId, setTargetId] = useState("");
  const [targetSlug, setTargetSlug] = useState("");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [dryRun, setDryRun] = useState(true);

  const isUuid = (v: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v.trim());
  const validId = targetId && isUuid(targetId);
  const effectiveTarget = validId ? targetId : (targetSlug || "BULK");
  const expectedPhrase = `DELETE ${purgeType} ${effectiveTarget}`;

  const handlePurge = async () => {
    setIsPurging(true);
    setPurgeResult(null);

    try {
      const body: any = {
        type: purgeType,
        mode: purgeMode,
        dryRun,
      };

      if (validId) body.id = targetId.trim();
      if (!validId && targetSlug) body.slug = targetSlug.trim();
      if (purgeMode === "hard" && !dryRun) {
        body.confirmationPhrase = confirmationPhrase;
      }

      const response = await fetch("/api/admin/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      
      if (result.ok) {
        setPurgeResult(result);
      } else {
        alert("Purge failed: " + result.error.message);
      }
    } catch (error) {
      alert("Purge failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsPurging(false);
    }
  };

  // Allow purge when we have an explicit target OR when doing a confirmed hard delete (BULK)
  const canPurge = Boolean(validId || targetSlug || (!dryRun && purgeMode === "hard"));
  const needsConfirmation = purgeMode === "hard" && !dryRun;

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft p-6">
      <div className="flex items-center gap-3 mb-4">
        <Trash2 className="w-5 h-5 text-red-600" />
        <h2 className="text-xl font-semibold">
          Purge Data
        </h2>
      </div>

      <div className="border border-red-600/30 bg-red-600/10 rounded-md p-3 mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700 font-medium">
            Warning: Purge operations are permanent!
          </p>
        </div>
        <p className="text-xs text-red-700 mt-1">
          Always test with dry run first. Hard deletes cannot be undone.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Type
            </label>
            <select
              value={purgeType}
              onChange={(e) => setPurgeType(e.target.value as "post" | "comment")}
              className="block w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="post">Posts</option>
              <option value="comment">Comments</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Mode
            </label>
            <select
              value={purgeMode}
              onChange={(e) => setPurgeMode(e.target.value as "soft" | "hard")}
              className="block w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="soft">Soft Delete (Recoverable)</option>
              <option value="hard">Hard Delete (Permanent)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Target ID (UUID)
          </label>
          <input
            type="text"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
            className="block w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
          {targetId && !validId && (
            <p className="mt-1 text-xs text-red-600">Not a valid UUID — slug will be used instead.</p>
          )}
        </div>

        {purgeType === "post" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Or Target Slug
            </label>
            <input
              type="text"
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              placeholder="e.g., my-blog-post"
              className="block w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border border-border"
          />
          <span>
            Dry run (preview what would be deleted)
          </span>
        </label>

        {needsConfirmation && (
          <div>
            <label className="block text-sm font-medium text-red-700 mb-2">
              Type confirmation phrase to proceed with hard delete:
            </label>
            <p className="text-sm text-muted mb-2">
              Required phrase: <code className="px-2 py-1 rounded text-xs bg-card border border-border">{expectedPhrase}</code>
            </p>
            <input
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder={expectedPhrase}
              className="block w-full rounded-md border border-red-600/50 bg-bg px-3 py-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={handlePurge}
          disabled={isPurging || !canPurge || (needsConfirmation && confirmationPhrase !== expectedPhrase)}
          className={`w-full px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
            purgeMode === "hard" && !dryRun
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-orange-600 hover:bg-orange-700 text-white"
          }`}
        >
          {isPurging ? (
            <>
              <Trash2 className="w-4 h-4 animate-pulse" />
              {dryRun ? "Analyzing..." : "Purging..."}
            </>
          ) : (
            <>
              {dryRun ? <Eye className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              {dryRun ? "Preview Purge" : `${purgeMode === "hard" ? "Hard" : "Soft"} Delete`}
            </>
          )}
        </button>

        {purgeResult && (
          <div className={`mt-4 p-4 border rounded-md ${
            purgeMode === "hard" && !purgeResult.dryRun
              ? "border-red-600/30 bg-red-600/10"
              : "border-orange-600/30 bg-orange-600/10"
          }`}>
            <h3 className={`font-semibold mb-2 ${
              purgeMode === "hard" && !purgeResult.dryRun
                ? "text-red-700"
                : "text-orange-700"
            }`}>
              {purgeResult.dryRun ? "Purge Preview" : "Purge Complete"}
            </h3>
            <div className={`text-sm space-y-1 ${
              purgeMode === "hard" && !purgeResult.dryRun
                ? "text-red-700"
                : "text-orange-700"
            }`}>
              <p><strong>Records Affected:</strong> {purgeResult.recordsAffected}</p>
              <p><strong>Type:</strong> {purgeResult.preview?.type}</p>
              <p><strong>Mode:</strong> {purgeResult.preview?.mode}</p>
              
              {purgeResult.preview?.cascadeEffects && Object.keys(purgeResult.preview.cascadeEffects).length > 0 && (
                <div className="mt-2">
                  <p><strong>Cascade Effects:</strong></p>
                  {Object.entries(purgeResult.preview.cascadeEffects).map(([type, count]: [string, any]) => (
                    <p key={type} className="ml-4 text-xs">
                      {count} {type} will also be affected
                    </p>
                  ))}
                </div>
              )}
            </div>
            {purgeResult.dryRun && (
              <p className={`mt-2 text-xs ${
                purgeMode === "hard"
                  ? "text-red-600"
                  : "text-orange-600"
              }`}>
                This was a preview. Uncheck "Dry run" to apply these changes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}