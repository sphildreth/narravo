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

  const expectedPhrase = `DELETE ${purgeType} ${targetId || targetSlug || "BULK"}`;

  const handlePurge = async () => {
    setIsPurging(true);
    setPurgeResult(null);

    try {
      const body: any = {
        type: purgeType,
        mode: purgeMode,
        dryRun,
      };

      if (targetId) body.id = targetId;
      if (targetSlug) body.slug = targetSlug;
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

  const canPurge = targetId || targetSlug;
  const needsConfirmation = purgeMode === "hard" && !dryRun;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Trash2 className="w-5 h-5 text-red-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Purge Data
        </h2>
      </div>

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-800 dark:text-red-200 font-medium">
            Warning: Purge operations are permanent!
          </p>
        </div>
        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
          Always test with dry run first. Hard deletes cannot be undone.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              value={purgeType}
              onChange={(e) => setPurgeType(e.target.value as "post" | "comment")}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option value="post">Posts</option>
              <option value="comment">Comments</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mode
            </label>
            <select
              value={purgeMode}
              onChange={(e) => setPurgeMode(e.target.value as "soft" | "hard")}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option value="soft">Soft Delete (Recoverable)</option>
              <option value="hard">Hard Delete (Permanent)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target ID (UUID)
          </label>
          <input
            type="text"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
          />
        </div>

        {purgeType === "post" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Or Target Slug
            </label>
            <input
              type="text"
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              placeholder="e.g., my-blog-post"
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Dry run (preview what would be deleted)
          </span>
        </label>

        {needsConfirmation && (
          <div>
            <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              Type confirmation phrase to proceed with hard delete:
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Required phrase: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{expectedPhrase}</code>
            </p>
            <input
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder={expectedPhrase}
              className="block w-full rounded-md border-red-300 dark:border-red-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={handlePurge}
          disabled={isPurging || !canPurge || (needsConfirmation && confirmationPhrase !== expectedPhrase)}
          className={`w-full px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
            purgeMode === "hard" && !dryRun
              ? "bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white"
              : "bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white"
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
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
          }`}>
            <h3 className={`font-semibold mb-2 ${
              purgeMode === "hard" && !purgeResult.dryRun
                ? "text-red-800 dark:text-red-200"
                : "text-orange-800 dark:text-orange-200"
            }`}>
              {purgeResult.dryRun ? "Purge Preview" : "Purge Complete"}
            </h3>
            <div className={`text-sm space-y-1 ${
              purgeMode === "hard" && !purgeResult.dryRun
                ? "text-red-700 dark:text-red-300"
                : "text-orange-700 dark:text-orange-300"
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
                  ? "text-red-600 dark:text-red-400"
                  : "text-orange-600 dark:text-orange-400"
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