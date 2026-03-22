// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataOperationLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { createBackup } from "../../../../../scripts/backup";
import crypto from "node:crypto";
import { nanoid } from "nanoid";

interface ExportRequest {
  includeMedia?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    
    const { includeMedia = true, dateFrom, dateTo }: ExportRequest = await req.json();
    
    // Create audit log entry
    const operationId = nanoid();
    const logEntry = await db.insert(dataOperationLogs).values({
      operationType: "export",
      userId: null, // TODO: Get from session when auth is implemented
      details: { includeMedia, dateFrom, dateTo, operationId },
      status: "started",
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    }).returning();

    try {
      // Generate export filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0]!.replace(/-/g, '');
      const filename = `narravo-export-${timestamp}-${operationId.slice(0, 8)}.zip`;
      
      // Create backup using existing script functionality
      const exportPath = await createBackup({
        outputPath: `/tmp/${filename}`,
        includeMedia,
        verbose: false,
      });

      // Calculate checksum without loading the whole file into memory
      const fs = await import("node:fs");
      const stat = await fs.promises.stat(exportPath);
      
      const checksum = await new Promise<string>((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(exportPath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
      });
      
      // Update audit log with completion
      await db.update(dataOperationLogs)
        .set({
          status: "completed",
          archiveFilename: filename,
          archiveChecksum: checksum,
          completedAt: new Date(),
        })
        .where(eq(dataOperationLogs.id, logEntry[0]!.id));

      return new Response(JSON.stringify({
        ok: true,
        operationId,
        filename,
        checksum,
        size: stat.size,
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