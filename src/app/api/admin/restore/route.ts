// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataOperationLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { restoreBackup } from "../../../../../scripts/restore";
import { nanoid } from "nanoid";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import logger from "@/lib/logger";

const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_BACKUP_BYTES + 1024 * 1024;

interface RestoreRequest {
  dryRun?: boolean;
  filterSlugs?: string[] | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  skipUsers?: boolean;
  skipConfiguration?: boolean;
  checksum?: string | undefined; // Expected checksum for verification
}

export async function POST(req: NextRequest) {
  try {
    const declaredLength = req.headers.get("content-length");
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_MULTIPART_BYTES)) {
      return new Response(JSON.stringify({
        ok: false,
        error: { message: "Restore request is too large" },
      }), { status: 413, headers: { "Content-Type": "application/json" } });
    }
    const session = await requireAdmin2FA();
    
    const formData = await req.formData();
    const file = formData.get("backupFile") as File;
    const filterSlugsValue = formData.get("filterSlugs");
    const startDateValue = formData.get("startDate");
    const endDateValue = formData.get("endDate");
    const checksumValue = formData.get("checksum");
    
    const options: RestoreRequest = {
      dryRun: formData.get("dryRun") === "true",
      filterSlugs: filterSlugsValue ? (filterSlugsValue as string).split(",") : undefined,
      startDate: startDateValue ? startDateValue as string : undefined,
      endDate: endDateValue ? endDateValue as string : undefined,
      skipUsers: formData.get("skipUsers") === "true",
      skipConfiguration: formData.get("skipConfiguration") === "true",
      checksum: checksumValue ? checksumValue as string : undefined,
    };

    if (!file) {
      return new Response(JSON.stringify({
        ok: false,
        error: { message: "Backup file is required" }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!(file instanceof File) || file.size <= 0 || file.size > MAX_BACKUP_BYTES) {
      return new Response(JSON.stringify({
        ok: false,
        error: { message: `Backup must be a ZIP no larger than ${MAX_BACKUP_BYTES} bytes` },
      }), { status: 413, headers: { "Content-Type": "application/json" } });
    }

    // Create audit log entry
    const operationId = nanoid();
    const logEntry = await db.insert(dataOperationLogs).values({
      operationType: "restore",
      userId: session.user?.id ?? null,
      details: { 
        ...options, 
        operationId,
        originalFilename: file.name,
        fileSize: file.size,
      },
      status: "started",
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    }).returning();

    try {
      // Save uploaded file to temp location
      const buffer = Buffer.from(await file.arrayBuffer());
      const tempFilename = `restore-${operationId}.zip`;
      const tempPath = `/tmp/${tempFilename}`;
      
      await fs.writeFile(tempPath, new Uint8Array(buffer));

      // Verify checksum if provided
      if (options.checksum) {
        const actualChecksum = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
        if (actualChecksum !== options.checksum) {
          await db.update(dataOperationLogs)
            .set({
              status: "failed",
              errorMessage: "Checksum verification failed",
              completedAt: new Date(),
            })
            .where(eq(dataOperationLogs.id, logEntry[0]!.id));

          return new Response(JSON.stringify({
            ok: false,
            error: { message: "Checksum verification failed" }
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Perform restore
      const restoreOptions: any = {
        backupPath: tempPath,
        dryRun: options.dryRun ?? false,
        skipUsers: options.skipUsers ?? false,
        skipConfiguration: options.skipConfiguration ?? false,
        verbose: false,
      };
      
      if (options.filterSlugs) {
        restoreOptions.filterSlugs = options.filterSlugs;
      }
      if (options.startDate) {
        restoreOptions.startDate = new Date(options.startDate);
      }
      if (options.endDate) {
        restoreOptions.endDate = new Date(options.endDate);
      }
      
      const result = await restoreBackup(restoreOptions);

      // Calculate total records affected
      let recordsAffected = 0;
      if (result?.tables) {
        for (const table of Object.values(result.tables)) {
          recordsAffected += table.toInsert + table.toUpdate;
        }
      }

      // Update audit log with completion
      await db.update(dataOperationLogs)
        .set({
          status: "completed",
          recordsAffected,
          completedAt: new Date(),
        })
        .where(eq(dataOperationLogs.id, logEntry[0]!.id));

      return new Response(JSON.stringify({
        ok: true,
        operationId,
        dryRun: options.dryRun,
        recordsAffected,
        preview: result,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      // Update audit log with error
      await db.update(dataOperationLogs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(dataOperationLogs.id, logEntry[0]!.id));

      throw error;
    } finally {
      try {
        await fs.unlink(`/tmp/restore-${operationId}.zip`);
      } catch {
        // Best-effort cleanup of a non-sensitive temporary archive.
      }
    }

  } catch (err) {
    logger.error("Restore API failed", err);
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 500;
    
    return new Response(JSON.stringify({
      ok: false,
      error: { message: status === 500 ? "Restore failed" : message }
    }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}
