// SPDX-License-Identifier: Apache-2.0
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { importJobs, importJobErrors } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { requireAdmin2FA } from "@/lib/auth";
import { importWxr } from "../../../scripts/import-wxr";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import logger from '@/lib/logger';
import { safeApiError } from "@/lib/api-error";
import { normalizeAllowedHosts } from "@/lib/safe-remote-fetch";
import { z } from "zod";

const MAX_WXR_BYTES = 50 * 1024 * 1024;
const IMPORT_TEMP_DIR = "/tmp/narravo-imports";

const importOptionsSchema = z.strictObject({
  dryRun: z.boolean().default(false),
  skipMedia: z.boolean().default(false),
  purgeBeforeImport: z.boolean().default(false),
  allowedStatuses: z.array(z.enum(["publish", "draft", "private", "pending"])).max(4).default(["publish"]),
  concurrency: z.number().int().min(1).max(10).default(4),
  allowedHosts: z.array(z.string().min(1).max(253)).max(50).default([]),
  rebuildExcerpts: z.boolean().default(false),
});

function isImportTempPath(candidate: string): boolean {
  const relative = path.relative(IMPORT_TEMP_DIR, path.resolve(candidate));
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

interface ImportJobResult {
  job?: typeof importJobs.$inferSelect | undefined;
  error?: string | undefined;
}

export async function startImportJob(formData: FormData): Promise<ImportJobResult> {
  let tempPathToCleanup: string | null = null;
  try {
    const session = await requireAdmin2FA();

    const file = formData.get("file");
    const optionsJson = formData.get("options");
    
    if (!(file instanceof File)) {
      return { error: "No file provided" };
    }
    if (file.size <= 0 || file.size > MAX_WXR_BYTES) {
      return { error: `WXR file must be no larger than ${MAX_WXR_BYTES} bytes` };
    }
    if (typeof optionsJson !== "string" || optionsJson.length > 100_000) {
      return { error: "Invalid options format" };
    }

    let options;
    try {
      const parsedOptions = importOptionsSchema.safeParse(JSON.parse(optionsJson));
      if (!parsedOptions.success) return { error: "Invalid options format" };
      options = {
        ...parsedOptions.data,
        allowedHosts: normalizeAllowedHosts(parsedOptions.data.allowedHosts),
      };
    } catch {
      return { error: "Invalid options format" };
    }

    // Validate file type
    if (!file.name.endsWith('.xml')) {
      return { error: "File must be a .xml file" };
    }

    // Create temporary file
    const tempDir = IMPORT_TEMP_DIR;
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFileName = `${nanoid()}.xml`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    // Save uploaded file
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, new Uint8Array(arrayBuffer));
    tempPathToCleanup = tempFilePath;

    // Create job record
    const jobResult = await db.insert(importJobs).values({
      fileName: path.basename(file.name).slice(0, 255),
      filePath: tempFilePath,
      options,
      userId: session.user?.id,
      status: "queued",
    }).returning();
    
    const job = jobResult[0];
    if (!job) {
      await fs.unlink(tempFilePath).catch(() => undefined);
      tempPathToCleanup = null;
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
          logger.error("Import job failed:", error);
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
      tempPathToCleanup = null; // Background job owns cleanup from here.
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
        tempPathToCleanup = null;
      }
    }

    revalidatePath("/admin/system/import");
    
    // Get updated job
    const updatedJobResult = await db.select().from(importJobs).where(eq(importJobs.id, job.id));
    const updatedJob = updatedJobResult[0];
    
    return { job: updatedJob || job };
  } catch (error) {
    if (tempPathToCleanup) {
      try { await fs.unlink(tempPathToCleanup); } catch { /* best effort cleanup */ }
    }
    logger.error("Start import job error:", error);
    return { error: safeApiError(error, "Failed to start import job").message };
  }
}

export async function cancelImportJob(jobId: string): Promise<ImportJobResult> {
  try {
    await requireAdmin2FA();

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
    logger.error("Cancel import job error:", error);
    return { error: safeApiError(error, "Failed to cancel import job").message };
  }
}

export async function retryImportJob(jobId: string): Promise<ImportJobResult> {
  try {
    await requireAdmin2FA();

    // Get existing job
    const existingJobResult = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
    const existingJob = existingJobResult[0];
    if (!existingJob) {
      return { error: "Job not found" };
    }

    const parsedOptions = importOptionsSchema.safeParse(existingJob.options);
    if (!parsedOptions.success) {
      return { error: "Stored import options are invalid; upload the file again" };
    }
    const retryOptions = {
      ...parsedOptions.data,
      allowedHosts: normalizeAllowedHosts(parsedOptions.data.allowedHosts),
    };

    if (!isImportTempPath(existingJob.filePath)) {
      return { error: "Stored import path is invalid" };
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
          ...retryOptions,
          jobId: job.id,
        });
      } catch (error) {
        logger.error("Retry import job failed:", error);
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
    logger.error("Retry import job error:", error);
    return { error: safeApiError(error, "Failed to retry import job").message };
  }
}

export async function deleteImportJob(jobId: string): Promise<ImportJobResult> {
  try {
    await requireAdmin2FA();

    // Get existing job to check file path
    const existingJobResult = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
    const existingJob = existingJobResult[0];
    if (!existingJob) {
      return { error: "Job not found" };
    }

    // Clean up file if it exists
    if (isImportTempPath(existingJob.filePath)) {
      try {
        await fs.unlink(existingJob.filePath);
      } catch {
        // Ignore file cleanup errors (file may not exist)
      }
    }

    // Delete job record (this will cascade delete related errors due to FK constraint)
    await db.delete(importJobs).where(eq(importJobs.id, jobId));

    revalidatePath("/admin/system/import");
    return { job: existingJob };
  } catch (error) {
    logger.error("Delete import job error:", error);
    return { error: safeApiError(error, "Failed to delete import job").message };
  }
}
