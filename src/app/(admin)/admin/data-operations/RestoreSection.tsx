// SPDX-License-Identifier: Apache-2.0
"use client";

import { useState } from "react";
import { Upload, Eye, Database } from "lucide-react";

export function RestoreSection() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checksum, setChecksum] = useState("");
  const [dryRun, setDryRun] = useState(true);

  const handleRestore = async () => {
    if (!file) {
      alert("Please select a backup file");
      return;
    }

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append("backupFile", file);
      formData.append("dryRun", dryRun.toString());
      formData.append("skipUsers", "false");
      formData.append("skipConfiguration", "false");
      if (checksum) {
        formData.append("checksum", checksum);
      }

      const response = await fetch("/api/admin/restore", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      if (result.ok) {
        setRestoreResult(result);
      } else {
        alert("Restore failed: " + result.error.message);
      }
    } catch (error) {
      alert("Restore failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Upload className="w-5 h-5 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Restore Data
        </h2>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Restore from a previously created export. Always test with dry run first.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Backup File
          </label>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Expected Checksum (optional)
          </label>
          <input
            type="text"
            value={checksum}
            onChange={(e) => setChecksum(e.target.value)}
            placeholder="SHA-256 hash for verification"
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Dry run (preview changes without applying)
          </span>
        </label>

        <button
          onClick={handleRestore}
          disabled={isRestoring || !file}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isRestoring ? (
            <>
              <Database className="w-4 h-4 animate-pulse" />
              {dryRun ? "Analyzing..." : "Restoring..."}
            </>
          ) : (
            <>
              {dryRun ? <Eye className="w-4 h-4" /> : <Database className="w-4 h-4" />}
              {dryRun ? "Preview Restore" : "Restore Data"}
            </>
          )}
        </button>

        {restoreResult && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              {restoreResult.dryRun ? "Restore Preview" : "Restore Complete"}
            </h3>
            <div className="text-sm space-y-1 text-blue-700 dark:text-blue-300">
              <p><strong>Records Affected:</strong> {restoreResult.recordsAffected}</p>
              {restoreResult.preview?.tables && (
                <div className="mt-2">
                  <p><strong>Changes by Table:</strong></p>
                  {Object.entries(restoreResult.preview.tables).map(([table, counts]: [string, any]) => (
                    <p key={table} className="ml-4 text-xs">
                      {table}: {counts.toInsert} new, {counts.toUpdate} updated, {counts.toSkip} skipped
                    </p>
                  ))}
                </div>
              )}
            </div>
            {restoreResult.dryRun && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                This was a preview. Uncheck "Dry run" to apply these changes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}