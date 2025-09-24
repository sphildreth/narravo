// SPDX-License-Identifier: Apache-2.0
"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Upload, Trash2, Clock } from "lucide-react";

interface AuditLogEntry {
  id: string;
  operationType: "export" | "restore" | "purge_soft" | "purge_hard";
  status: string;
  recordsAffected: number;
  archiveFilename?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  details: any;
}

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      // This would need to be implemented as an actual API endpoint
      // For now, we'll show a placeholder
      setLogs([]);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case "export":
        return <Download className="w-4 h-4 text-blue-600" />;
      case "restore":
        return <Upload className="w-4 h-4 text-green-600" />;
      case "purge_soft":
        return <Trash2 className="w-4 h-4 text-orange-600" />;
      case "purge_hard":
        return <Trash2 className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 dark:text-green-400";
      case "failed":
        return "text-red-600 dark:text-red-400";
      case "started":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const formatOperationType = (type: string) => {
    switch (type) {
      case "export":
        return "Export";
      case "restore":
        return "Restore";
      case "purge_soft":
        return "Soft Delete";
      case "purge_hard":
        return "Hard Delete";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Audit Log
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Clock className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Audit Log
        </h2>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Track all data operations with detailed audit logging for security and compliance.
      </p>

      {logs.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No audit logs yet. Data operations will be tracked here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getOperationIcon(log.operationType)}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {formatOperationType(log.operationType)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={`text-sm font-medium ${getStatusColor(log.status)}`}>
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                  {log.recordsAffected > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {log.recordsAffected} records affected
                    </p>
                  )}
                </div>
              </div>

              {log.archiveFilename && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Archive: {log.archiveFilename}
                </p>
              )}

              {log.errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Error: {log.errorMessage}
                </p>
              )}

              {log.completedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Completed: {new Date(log.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}