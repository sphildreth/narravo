// SPDX-License-Identifier: Apache-2.0
"use client";

import { useState } from "react";
import { Download, FileArchive, Clock } from "lucide-react";

export function ExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [includeMedia, setIncludeMedia] = useState(true);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const response = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeMedia,
        }),
      });

      const result = await response.json();
      
      if (result.ok) {
        setExportResult(result);
      } else {
        alert("Export failed: " + result.error.message);
      }
    } catch (error) {
      alert("Export failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!exportResult?.operationId) return;

    try {
      const response = await fetch(
        `/api/admin/export/${exportResult.operationId}?action=download`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = exportResult.filename || "narravo-export.zip";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const result = await response.json();
        alert("Download failed: " + result.error.message);
      }
    } catch (error) {
      alert("Download failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileArchive className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Export Data
        </h2>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Create a complete backup of your posts, comments, users, and configuration.
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeMedia}
            onChange={(e) => setIncludeMedia(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Include media files (images, videos)
          </span>
        </label>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isExporting ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              Creating Export...
            </>
          ) : (
            <>
              <FileArchive className="w-4 h-4" />
              Start Export
            </>
          )}
        </button>

        {exportResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
              Export Complete
            </h3>
            <div className="text-sm space-y-1 text-green-700 dark:text-green-300">
              <p><strong>File:</strong> {exportResult.filename}</p>
              <p><strong>Size:</strong> {(exportResult.size / 1024).toFixed(1)} KB</p>
              <p><strong>Checksum:</strong> <code className="text-xs">{exportResult.checksum.slice(0, 16)}...</code></p>
            </div>
            <button
              onClick={handleDownload}
              className="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}