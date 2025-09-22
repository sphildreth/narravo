// SPDX-License-Identifier: Apache-2.0
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { importJobs, importJobErrors } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { importWxr } from "../../../scripts/import-wxr";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

interface ImportJobResult {
  job?: typeof importJobs.$inferSelect | undefined;
  error?: string | undefined;
}

export async function startImportJob(formData: FormData): Promise<ImportJobResult> {
  try {
    const session = await auth();
    if (!session?.user || !(session.user as any).isAdmin) {
      return { error: "Unauthorized" };
    }

    const file = formData.get("file") as File;
    const optionsJson = formData.get("options") as string;
    
    if (!file) {
      return { error: "No file provided" };
    }

    let options;
    try {
      options = JSON.parse(optionsJson);
    } catch {
      return { error: "Invalid options format" };
    }

    // Validate file type
    if (!file.name.endsWith('.xml')) {
      return { error: "File must be a .xml file" };
    }

    // Create temporary file
    const tempDir = "/tmp/narravo-imports";
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFileName = `${nanoid()}-${file.name}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    // Save uploaded file
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, new Uint8Array(arrayBuffer));

    // Create job record
    const jobResult = await db.insert(importJobs).values({
      fileName: file.name,
      filePath: tempFilePath,
      options,
      userId: session.user.id,
      status: "queued",
    }).returning();
    
    const job = jobResult[0];
    if (!job) {
      return { error: "Failed to create job record" };
    }

    // Start import in background
    if (!options.dryRun) {
      // For production, this should use a proper queue system
      // For MVP, we'll run it immediately but update status
      setImmediate(async () => {
        try {
          await importWxr(tempFilePath, {
            ...options,
            jobId: job.id,
          });
        } catch (error) {
          console.error("Import job failed:", error);
          await db.update(importJobs)
            .set({ 
              status: "failed",
              finishedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(importJobs.id, job.id));
        } finally {
          // Clean up temp file
          try {
            await fs.unlink(tempFilePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      });
    } else {
      // For dry run, execute immediately and return results
      try {
        const result = await importWxr(tempFilePath, {
          ...options,
          jobId: job.id,
        });
        
        await db.update(importJobs)
          .set({ 
            status: "completed",
            startedAt: new Date(),
            finishedAt: new Date(),
            updatedAt: new Date(),
            totalItems: result.summary.totalItems,
            postsImported: result.summary.postsImported,
            attachmentsProcessed: result.summary.attachmentsProcessed,
            redirectsCreated: result.summary.redirectsCreated,
            skipped: result.summary.skipped,
          })
          .where(eq(importJobs.id, job.id));
      } catch (error) {
        await db.update(importJobs)
          .set({ 
            status: "failed",
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(importJobs.id, job.id));
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    revalidatePath("/admin/system/import");
    
    // Get updated job
    const updatedJobResult = await db.select().from(importJobs).where(eq(importJobs.id, job.id));
    const updatedJob = updatedJobResult[0];
    
    return { job: updatedJob || job };
  } catch (error) {
    console.error("Start import job error:", error);
    return { error: error instanceof Error ? error.message : "Failed to start import job" };
  }
}

export async function cancelImportJob(jobId: string): Promise<ImportJobResult> {
  try {
    const session = await auth();
    if (!session?.user || !(session.user as any).isAdmin) {
      return { error: "Unauthorized" };
    }

    const jobResult = await db.update(importJobs)
      .set({ 
        status: "cancelling",
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId))
      .returning();

    const job = jobResult[0];
    if (!job) {
      return { error: "Job not found" };
    }

    // Note: For a proper implementation, you'd need to signal the running import
    // to stop gracefully. This is a simplified version.
    
    // After a delay, mark as cancelled
    setTimeout(async () => {
      await db.update(importJobs)
        .set({ 
          status: "cancelled",
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importJobs.id, jobId));
    }, 1000);

    revalidatePath("/admin/system/import");
    return { job };
  } catch (error) {
    console.error("Cancel import job error:", error);
    return { error: error instanceof Error ? error.message : "Failed to cancel import job" };
  }
}

export async function retryImportJob(jobId: string): Promise<ImportJobResult> {
  try {
    const session = await auth();
    if (!session?.user || !(session.user as any).isAdmin) {
      return { error: "Unauthorized" };
    }

    // Get existing job
    const existingJobResult = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
    const existingJob = existingJobResult[0];
    if (!existingJob) {
      return { error: "Job not found" };
    }

    // Check if file still exists (it probably doesn't for completed jobs)
    let fileExists = false;
    try {
      await fs.access(existingJob.filePath);
      fileExists = true;
    } catch {
      // File doesn't exist
    }

    if (!fileExists) {
      return { error: "Original file no longer available. Please upload the file again." };
    }

    // Reset job to queued status
    const jobResult = await db.update(importJobs)
      .set({ 
        status: "queued",
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
        totalItems: 0,
        postsImported: 0,
        attachmentsProcessed: 0,
        redirectsCreated: 0,
        skipped: 0,
      })
      .where(eq(importJobs.id, jobId))
      .returning();

    const job = jobResult[0];
    if (!job) {
      return { error: "Failed to reset job" };
    }

    // Clear existing errors
    await db.delete(importJobErrors).where(eq(importJobErrors.jobId, jobId));

    // Restart import
    setImmediate(async () => {
      try {
        await importWxr(existingJob.filePath, {
          ...existingJob.options as any,
          jobId: job.id,
        });
      } catch (error) {
        console.error("Retry import job failed:", error);
        await db.update(importJobs)
          .set({ 
            status: "failed",
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(importJobs.id, job.id));
      }
    });

    revalidatePath("/admin/system/import");
    return { job };
  } catch (error) {
    console.error("Retry import job error:", error);
    return { error: error instanceof Error ? error.message : "Failed to retry import job" };
  }
}