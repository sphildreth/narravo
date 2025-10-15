#!/usr/bin/env tsx
// SPDX-License-Identifier: Apache-2.0

/**
 * Cleanup script for temporary uploads that were never committed to a post.
 * Run this periodically (e.g., via cron) to clean up orphaned uploads.
 * 
 * Usage:
 *   tsx scripts/cleanup-uploads.ts [--dry-run] [--age-hours=24]
 */

import { db } from "../src/lib/db";
import { uploads } from "../drizzle/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { localStorageService } from "../src/lib/local-storage";
import { getStorageService } from "../src/lib/s3";
import logger from "../src/lib/logger";

async function cleanup(dryRun: boolean = false, ageHours: number = 24) {
  console.log(`🧹 Cleaning up temporary uploads older than ${ageHours} hours...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  
  try {
    // Find temporary uploads older than the specified age
    const cutoffDate = new Date(Date.now() - ageHours * 60 * 60 * 1000);
    
    const orphanedUploads = await db
      .select()
      .from(uploads)
      .where(
        and(
          eq(uploads.status, "temporary"),
          lt(uploads.createdAt, cutoffDate)
        )
      );
    
    if (orphanedUploads.length === 0) {
      console.log('✅ No orphaned uploads found.');
      return;
    }
    
    console.log(`Found ${orphanedUploads.length} orphaned uploads to clean up.`);
    
    if (!dryRun) {
      // Delete files from storage
      const storageService = getStorageService();
      let deletedCount = 0;
      let errorCount = 0;
      
      for (const upload of orphanedUploads) {
        try {
          if (storageService) {
            // Use cloud storage (S3/R2)
            await storageService.deleteObject(upload.key);
          } else {
            // Use local storage
            await localStorageService.deleteObject(upload.key);
          }
          deletedCount++;
        } catch (error) {
          logger.error(`Failed to delete file ${upload.key}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Deleted ${deletedCount} files from storage (${errorCount} errors)`);
      
      // Remove from database
      const uploadIds = orphanedUploads.map((u: any) => u.id);
      await db
        .delete(uploads)
        .where(sql`id = ANY(${uploadIds})`);
      
      console.log(`✅ Removed ${orphanedUploads.length} records from database.`);
    } else {
      console.log('\n📋 Would delete the following uploads:');
      for (const upload of orphanedUploads) {
        const age = Math.round((Date.now() - upload.createdAt!.getTime()) / (60 * 60 * 1000));
        console.log(`  - ${upload.key} (${age}h old, ${(upload.size / 1024).toFixed(1)}KB)`);
      }
    }
    
    console.log('\n✅ Cleanup complete.');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const ageArg = args.find(arg => arg.startsWith('--age-hours='));
const ageHours = ageArg ? parseInt(ageArg.split('=')[1] || '24') : 24;

cleanup(dryRun, ageHours)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
