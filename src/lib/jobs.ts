// SPDX-License-Identifier: Apache-2.0
/**
 * Background job processing for media tasks like video poster generation.
 * For MVP, this is implemented as in-process tasks but could be moved to
 * a proper queue system later.
 */

import { S3Service, getS3Config } from "./s3";
import { db } from "./db";
import { commentAttachments } from "@/drizzle/schema";
import logger from './logger';
import { eq } from "drizzle-orm";

export interface JobContext {
  db: typeof db;
  s3Service?: S3Service | undefined;
}

export interface PosterGenerationJob {
  attachmentId: string;
  videoUrl: string;
  videoKey: string;
}

/**
 * In MVP, we simulate poster generation since we don't have ffmpeg available.
 * In production, this would:
 * 1. Download the video from S3
 * 2. Use ffmpeg to extract a frame at 1 second
 * 3. Upload the poster image to S3
 * 4. Update the comment_attachments record with poster_url
 */
export async function generateVideoPoster(
  job: PosterGenerationJob,
  context: JobContext
): Promise<void> {
  try {
    logger.info(`Starting poster generation for attachment ${job.attachmentId}`);
    
    // For MVP, we'll create a placeholder poster URL
    // In production, this would involve actual video processing
    const posterKey = job.videoKey.replace(/\.[^.]+$/, '-poster.jpg');
    
    // Simulate poster generation with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In production, this would be the actual poster generation:
    // 1. const videoBuffer = await downloadFromS3(job.videoKey);
    // 2. const posterBuffer = await extractVideoFrame(videoBuffer, 1.0);
    // 3. const posterKey = await uploadToS3(posterBuffer, 'image/jpeg');
    
    let posterUrl: string;
    if (context.s3Service) {
      posterUrl = context.s3Service.getPublicUrl(posterKey);
    } else {
      // Development fallback - use a placeholder
      posterUrl = `https://via.placeholder.com/640x360/333/fff?text=Video+Poster`;
    }
    
    // Update the comment attachment with the poster URL
    await context.db
      .update(commentAttachments)
      .set({ posterUrl })
      .where(eq(commentAttachments.id, job.attachmentId));
    
    logger.info(`Poster generation completed for attachment ${job.attachmentId}`);
    
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error(`Failed to generate poster for attachment ${job.attachmentId}:`, error);
    }
    // In production, this would be retried or marked as failed
    throw error;
  }
}

/**
 * Process video poster generation for new video uploads.
 * In MVP, this runs in-process. In production, this would be queued.
 */
export async function enqueueVideoPosterGeneration(
  attachmentId: string,
  videoUrl: string,
  videoKey: string
): Promise<void> {
  const s3Config = getS3Config();
  const s3Service = s3Config ? new S3Service(s3Config) : undefined;
  
  const context: JobContext = {
    db,
    s3Service,
  };
  
  const job: PosterGenerationJob = {
    attachmentId,
    videoUrl,
    videoKey,
  };
  
  // For MVP, process immediately. In production, add to queue.
  await generateVideoPoster(job, context);
}

/**
 * Validate video duration (requires actual video processing in production).
 * For MVP, we'll skip this validation and trust the client.
 */
export async function validateVideoDuration(
  videoUrl: string,
  maxDurationSeconds: number
): Promise<boolean> {
  // In production, this would:
  // 1. Download video metadata
  // 2. Extract duration using ffprobe
  // 3. Compare with maxDurationSeconds
  
  logger.info(`Video duration validation skipped for MVP: ${videoUrl}`);
  return true; // Always pass in MVP
}

/**
 * Clean up temporary files and failed uploads (production feature).
 */
export async function cleanupFailedUploads(): Promise<void> {
  // In production, this would:
  // 1. Find comment_attachments with null posterUrl for videos older than X minutes
  // 2. Delete the associated S3 objects
  // 3. Remove the database records
  
  logger.info('Cleanup job completed (MVP no-op)');
}

// Export for testing
export const __testables__ = {
  generateVideoPoster,
  validateVideoDuration,
};