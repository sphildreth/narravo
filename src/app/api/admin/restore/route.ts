// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataOperationLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { restoreBackup } from "../../../../../scripts/restore";
import { nanoid } from "nanoid";
import crypto from "node:crypto";

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
    await requireAdmin();
    
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

    // Create audit log entry
    const operationId = nanoid();
    const logEntry = await db.insert(dataOperationLogs).values({
      operationType: "restore",
      userId: null, // TODO: Get from session when auth is implemented
      details: { 
        ...options, 
        operationId,
        originalFilename: file.name,
        fileSize: file.size,
      },
      status: "started",
      ipAddress: req.ip || req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    }).returning();

    try {
      // Save uploaded file to temp location
      const buffer = Buffer.from(await file.arrayBuffer());
      const tempFilename = `restore-${operationId}.zip`;
      const tempPath = `/tmp/${tempFilename}`;
      
      const fs = await import("node:fs/promises");
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

      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

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
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 500;
    
    return new Response(JSON.stringify({
      ok: false,
      error: { message }
    }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}