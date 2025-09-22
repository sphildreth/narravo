// SPDX-License-Identifier: Apache-2.0
"use client";

import { useState, useRef } from "react";
import { Upload, Play, Square, RotateCcw, FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { startImportJob, cancelImportJob, retryImportJob } from "@/app/actions/import";
import { useRouter } from "next/navigation";
import type { importJobs } from "@/drizzle/schema";

type ImportJob = typeof importJobs.$inferSelect;

interface ImportManagerProps {
  initialJobs: ImportJob[];
}

interface ImportOptions {
  dryRun: boolean;
  skipMedia: boolean;
  purgeBeforeImport: boolean;
  allowedStatuses: string[];
  concurrency: number;
  allowedHosts: string[];
}

const defaultOptions: ImportOptions = {
  dryRun: false,
  skipMedia: false,
  purgeBeforeImport: false,
  allowedStatuses: ["publish"],
  concurrency: 4,
  allowedHosts: [],
};

const statusColors = {
  queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelling: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const statusIcons = {
  queued: <Upload className="h-4 w-4" />,
  running: <Play className="h-4 w-4" />,
  cancelling: <Square className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
  failed: <AlertTriangle className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
};

export default function ImportManager({ initialJobs }: ImportManagerProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [options, setOptions] = useState<ImportOptions>(defaultOptions);
  const [allowedHostsInput, setAllowedHostsInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xml')) {
      setUploadError("Please select a .xml file");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({
        ...options,
        allowedHosts: allowedHostsInput.split('\n').filter(h => h.trim().length > 0).map(h => h.trim()),
      }));

      const result = await startImportJob(formData);
      
      if (result.error) {
        setUploadError(result.error);
      } else if (result.job) {
        setJobs(prev => [result.job!, ...prev]);
        // Reset form
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setOptions(defaultOptions);
        setAllowedHostsInput("");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelImportJob(jobId);
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: 'cancelling' as const } : job
      ));
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const result = await retryImportJob(jobId);
      if (result.error) {
        setUploadError(result.error);
      } else if (result.job) {
        setJobs(prev => prev.map(job => 
          job.id === jobId ? result.job! : job
        ));
      }
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const getProgress = (job: ImportJob) => {
    if (job.totalItems === 0) return 0;
    const processed = job.postsImported + job.attachmentsProcessed + job.skipped;
    return Math.round((processed / job.totalItems) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="border border-border rounded-lg p-6 bg-bg">
        <h2 className="text-lg font-semibold mb-4">Upload WXR File</h2>
        <p className="text-muted mb-4">
          Select a WordPress export (.xml) file and configure import options.
        </p>

        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {uploadError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <label htmlFor="file" className="block text-sm font-medium mb-2">WXR File</label>
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="statuses" className="block text-sm font-medium mb-2">Post Statuses to Import</label>
              <select
                id="statuses"
                value={options.allowedStatuses.join(',')}
                onChange={(e) => 
                  setOptions(prev => ({ ...prev, allowedStatuses: e.target.value.split(',') }))
                }
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="publish">Published only</option>
                <option value="publish,draft">Published + Drafts</option>
                <option value="publish,draft,private">Published + Drafts + Private</option>
                <option value="publish,draft,private,pending">All statuses</option>
              </select>
            </div>

            <div>
              <label htmlFor="concurrency" className="block text-sm font-medium mb-2">Concurrency (1-10)</label>
              <input
                id="concurrency"
                type="number"
                min="1"
                max="10"
                value={options.concurrency}
                onChange={(e) => 
                  setOptions(prev => ({ ...prev, concurrency: parseInt(e.target.value) || 4 }))
                }
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={options.dryRun}
                  onChange={(e) => 
                    setOptions(prev => ({ ...prev, dryRun: e.target.checked }))
                  }
                  className="rounded border-border"
                />
                <span className="text-sm">Dry run (preview only)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={options.skipMedia}
                  onChange={(e) => 
                    setOptions(prev => ({ ...prev, skipMedia: e.target.checked }))
                  }
                  className="rounded border-border"
                />
                <span className="text-sm">Skip media downloads</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={options.purgeBeforeImport}
                  onChange={(e) => 
                    setOptions(prev => ({ ...prev, purgeBeforeImport: e.target.checked }))
                  }
                  className="rounded border-border"
                />
                <span className="text-sm text-red-600">Purge all data before import (destructive!)</span>
              </label>
            </div>

            <div>
              <label htmlFor="allowedHosts" className="block text-sm font-medium mb-2">
                Allowed Media Hosts (one per line, empty = allow all)
              </label>
              <textarea
                id="allowedHosts"
                className="w-full h-20 p-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="example.com&#10;cdn.example.com"
                value={allowedHostsInput}
                onChange={(e) => setAllowedHostsInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isUploading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted">Uploading and starting import...</p>
          </div>
        )}
      </div>

      {/* Job List */}
      <div className="border border-border rounded-lg p-6 bg-bg">
        <h2 className="text-lg font-semibold mb-4">Import Jobs</h2>
        <p className="text-muted mb-4">
          Recent import jobs and their status. Click on a job to view detailed errors.
        </p>

        {jobs.length === 0 ? (
          <p className="text-muted text-center py-8">
            No import jobs yet. Upload a WXR file to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {statusIcons[job.status]}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                        {job.status}
                      </span>
                    </div>
                    <span className="font-medium">{job.fileName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20 flex items-center"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Cancel
                      </button>
                    )}
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20 flex items-center"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/admin/system/import/${job.id}`)}
                      className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20 flex items-center"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Details
                    </button>
                  </div>
                </div>

                {job.status === 'running' && job.totalItems > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{getProgress(job)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${getProgress(job)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-muted">Total Items</div>
                    <div className="font-medium">{job.totalItems.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted">Posts</div>
                    <div className="font-medium">{job.postsImported.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted">Attachments</div>
                    <div className="font-medium">{job.attachmentsProcessed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted">Redirects</div>
                    <div className="font-medium">{job.redirectsCreated.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted">Skipped</div>
                    <div className="font-medium">{job.skipped.toLocaleString()}</div>
                  </div>
                </div>

                <div className="text-xs text-muted">
                  Started: {formatDate(job.startedAt)} | 
                  Finished: {formatDate(job.finishedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}