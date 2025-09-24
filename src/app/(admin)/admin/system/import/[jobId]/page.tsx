// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { importJobs, importJobErrors } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface Props {
  params: { jobId: string };
}

export default async function ImportJobDetailsPage({ params }: Props) {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, params.jobId));
  
  if (!job) {
    notFound();
  }

  const errors = await db
    .select()
    .from(importJobErrors)
    .where(eq(importJobErrors.jobId, params.jobId))
    .orderBy(importJobErrors.createdAt);

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getProgress = () => {
    if (job.totalItems === 0) return 0;
    const processed = job.postsImported + job.attachmentsProcessed + job.skipped;
    return Math.round((processed / job.totalItems) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/admin/system/import"
          className="flex items-center space-x-2 text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Import</span>
        </Link>
      </div>

      <div className="flex items-center space-x-3">
        {getStatusIcon(job.status)}
        <h1 className="text-xl font-bold">{job.fileName}</h1>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          job.status === 'completed' ? 'bg-green-100 text-green-800' :
          job.status === 'failed' ? 'bg-red-100 text-red-800' :
          job.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {job.status}
        </span>
      </div>

      {/* Job Summary */}
      <div className="border border-border rounded-lg p-6 bg-bg">
        <h2 className="text-lg font-semibold mb-4">Import Summary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <div>
            <div className="text-sm text-muted">Status</div>
            <div className="font-medium capitalize">{job.status}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Started</div>
            <div className="font-medium">{formatDate(job.startedAt)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Finished</div>
            <div className="font-medium">{formatDate(job.finishedAt)}</div>
          </div>
        </div>

        {job.status === 'running' && job.totalItems > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{getProgress()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-brand h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 border border-border rounded">
            <div className="text-2xl font-bold">{job.totalItems.toLocaleString()}</div>
            <div className="text-sm text-muted">Total Items</div>
          </div>
          <div className="text-center p-4 border border-border rounded">
            <div className="text-2xl font-bold text-green-600">{job.postsImported.toLocaleString()}</div>
            <div className="text-sm text-muted">Posts Imported</div>
          </div>
          <div className="text-center p-4 border border-border rounded">
            <div className="text-2xl font-bold text-blue-600">{job.attachmentsProcessed.toLocaleString()}</div>
            <div className="text-sm text-muted">Attachments</div>
          </div>
          <div className="text-center p-4 border border-border rounded">
            <div className="text-2xl font-bold text-purple-600">{job.redirectsCreated.toLocaleString()}</div>
            <div className="text-sm text-muted">Redirects</div>
          </div>
          <div className="text-center p-4 border border-border rounded">
            <div className="text-2xl font-bold text-yellow-600">{job.skipped.toLocaleString()}</div>
            <div className="text-sm text-muted">Skipped</div>
          </div>
        </div>
      </div>

      {/* Import Options */}
      <div className="border border-border rounded-lg p-6 bg-bg">
        <h2 className="text-lg font-semibold mb-4">Import Options</h2>
        <pre className="bg-muted/10 p-4 rounded text-sm overflow-auto">
{JSON.stringify(job.options, null, 2)}
        </pre>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="border border-border rounded-lg p-6 bg-bg">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            Errors ({errors.length})
          </h2>
          
          <div className="space-y-4">
            {errors.map((error, index) => (
              <div key={error.id} className="border border-red-200 rounded p-4 bg-red-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-red-800">
                    {error.errorType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className="text-xs text-red-600">
                    {formatDate(error.createdAt)}
                  </div>
                </div>
                <div className="text-sm text-red-700 mb-2">
                  <strong>Item:</strong> {error.itemIdentifier}
                </div>
                <div className="text-sm text-red-700 mb-3">
                  <strong>Error:</strong> {error.errorMessage}
                </div>
                {error.itemData ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800">
                      Item Data
                    </summary>
                    <pre className="mt-2 bg-red-100 p-2 rounded overflow-auto">
{JSON.stringify(error.itemData, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Errors */}
      {errors.length === 0 && job.status === 'completed' && (
        <div className="border border-green-200 rounded-lg p-6 bg-green-50">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">
              Import completed successfully with no errors!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}