// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataOperationLogs } from "@/drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { operationId: string } }
) {
  try {
    await requireAdmin();
    
    const { operationId } = params;
    
    // Find the export operation
    const [operation] = await db
      .select()
      .from(dataOperationLogs)
      .where(
        and(
          eq(dataOperationLogs.operationType, "export"),
          sql`details->>'operationId' = ${operationId}`
        )
      )
      .limit(1);

    if (!operation) {
      return new Response(JSON.stringify({
        ok: false,
        error: { message: "Export operation not found" }
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check if the operation is complete and provide download
    if (operation.status === "completed" && operation.archiveFilename) {
      const action = req.nextUrl.searchParams.get("action");
      
      if (action === "download") {
        // Serve the file for download
        const fs = await import("node:fs/promises");
        const filePath = `/tmp/${operation.archiveFilename}`;
        
        try {
          const buffer = await fs.readFile(filePath);
          
          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": `attachment; filename="${operation.archiveFilename}"`,
              "Content-Length": buffer.length.toString(),
            }
          });
        } catch (fileError) {
          return new Response(JSON.stringify({
            ok: false,
            error: { message: "Export file no longer available" }
          }), {
            status: 410,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    // Return operation status
    return new Response(JSON.stringify({
      ok: true,
      operation: {
        id: operationId,
        status: operation.status,
        filename: operation.archiveFilename,
        checksum: operation.archiveChecksum,
        createdAt: operation.createdAt,
        completedAt: operation.completedAt,
        errorMessage: operation.errorMessage,
        details: operation.details,
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

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