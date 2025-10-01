// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { ExportSection } from "./ExportSection";
import { RestoreSection } from "./RestoreSection";
import { PurgeSection } from "./PurgeSection";
import { AuditLogSection } from "./AuditLogSection";

export default async function DataOperationsPage() {
  await requireAdmin2FA();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Data Operations</h1>
        <p className="mt-2 text-muted">
          Export, restore, and purge data with proper audit logging and confirmation flows.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Export Operations */}
        <div className="space-y-6">
          <ExportSection />
          <RestoreSection />
        </div>

        {/* Purge Operations */}
        <div className="space-y-6">
          <PurgeSection />
        </div>
      </div>

      {/* Audit Log */}
      <div className="mt-12">
        <AuditLogSection />
      </div>
    </div>
  );
}