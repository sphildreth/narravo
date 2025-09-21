// SPDX-License-Identifier: Apache-2.0
import JSZip from "jszip";
import { db } from "../lib/db";
import { posts, users, comments, commentAttachments, reactions, redirects, configuration } from "../drizzle/schema";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getS3Config, S3Service } from "../lib/s3";

export interface BackupManifest {
  version: number;
  createdUtc: string;
  tables: {
    [tableName: string]: {
      filename: string;
      recordCount: number;
      sha256: string;
    };
  };
  media: Array<{
    path: string;
    sha256: string;
    bytes: number;
  }>;
  counts: {
    posts: number;
    users: number;
    comments: number;
    reactions: number;
    redirects: number;
    configuration: number;
  };
}

export interface BackupOptions {
  outputPath?: string | undefined;
  includeMedia?: boolean;
  verbose?: boolean;
}

export async function createBackup(options: BackupOptions = {}): Promise<string> {
  const {
    outputPath = `backup-${new Date().toISOString().split('T')[0]}.zip`,
    includeMedia = true,
    verbose = false
  } = options;

  if (verbose) {
    console.log("Starting backup creation...");
  }

  const zip = new JSZip();
  const manifest: BackupManifest = {
    version: 1,
    createdUtc: new Date().toISOString(),
    tables: {},
    media: [],
    counts: {
      posts: 0,
      users: 0,
      comments: 0,
      reactions: 0,
      redirects: 0,
      configuration: 0,
    },
  };

  // Export posts
  if (verbose) console.log("Exporting posts...");
  const postsData = await db.select().from(posts);
  manifest.counts.posts = postsData.length;
  const postsJson = JSON.stringify(postsData, null, 2);
  const postsHash = crypto.createHash('sha256').update(postsJson).digest('hex');
  zip.file("db/posts.json", postsJson);
  manifest.tables.posts = {
    filename: "db/posts.json",
    recordCount: postsData.length,
    sha256: postsHash,
  };

  // Export users
  if (verbose) console.log("Exporting users...");
  const usersData = await db.select().from(users);
  manifest.counts.users = usersData.length;
  const usersJson = JSON.stringify(usersData, null, 2);
  const usersHash = crypto.createHash('sha256').update(usersJson).digest('hex');
  zip.file("db/users.json", usersJson);
  manifest.tables.users = {
    filename: "db/users.json",
    recordCount: usersData.length,
    sha256: usersHash,
  };

  // Export comments
  if (verbose) console.log("Exporting comments...");
  const commentsData = await db.select().from(comments);
  manifest.counts.comments = commentsData.length;
  const commentsJson = JSON.stringify(commentsData, null, 2);
  const commentsHash = crypto.createHash('sha256').update(commentsJson).digest('hex');
  zip.file("db/comments.json", commentsJson);
  manifest.tables.comments = {
    filename: "db/comments.json",
    recordCount: commentsData.length,
    sha256: commentsHash,
  };

  // Export comment attachments
  if (verbose) console.log("Exporting comment attachments...");
  const attachmentsData = await db.select().from(commentAttachments);
  const attachmentsJson = JSON.stringify(attachmentsData, null, 2);
  const attachmentsHash = crypto.createHash('sha256').update(attachmentsJson).digest('hex');
  zip.file("db/comment_attachments.json", attachmentsJson);
  manifest.tables.comment_attachments = {
    filename: "db/comment_attachments.json",
    recordCount: attachmentsData.length,
    sha256: attachmentsHash,
  };

  // Export reactions
  if (verbose) console.log("Exporting reactions...");
  const reactionsData = await db.select().from(reactions);
  manifest.counts.reactions = reactionsData.length;
  const reactionsJson = JSON.stringify(reactionsData, null, 2);
  const reactionsHash = crypto.createHash('sha256').update(reactionsJson).digest('hex');
  zip.file("db/reactions.json", reactionsJson);
  manifest.tables.reactions = {
    filename: "db/reactions.json",
    recordCount: reactionsData.length,
    sha256: reactionsHash,
  };

  // Export redirects
  if (verbose) console.log("Exporting redirects...");
  const redirectsData = await db.select().from(redirects);
  manifest.counts.redirects = redirectsData.length;
  const redirectsJson = JSON.stringify(redirectsData, null, 2);
  const redirectsHash = crypto.createHash('sha256').update(redirectsJson).digest('hex');
  zip.file("db/redirects.json", redirectsJson);
  manifest.tables.redirects = {
    filename: "db/redirects.json",
    recordCount: redirectsData.length,
    sha256: redirectsHash,
  };

  // Export configuration
  if (verbose) console.log("Exporting configuration...");
  const configData = await db.select().from(configuration);
  manifest.counts.configuration = configData.length;
  const configJson = JSON.stringify(configData, null, 2);
  const configHash = crypto.createHash('sha256').update(configJson).digest('hex');
  zip.file("db/configuration.json", configJson);
  manifest.tables.configuration = {
    filename: "db/configuration.json",
    recordCount: configData.length,
    sha256: configHash,
  };

  // Export media manifest (without actual files for MVP)
  if (includeMedia) {
    if (verbose) console.log("Creating media manifest...");
    
    // Collect all media URLs from comment attachments
    const mediaUrls = new Set<string>();
    attachmentsData.forEach(attachment => {
      if (attachment.url) mediaUrls.add(attachment.url);
      if (attachment.posterUrl) mediaUrls.add(attachment.posterUrl);
    });

    // For MVP, we'll just create the manifest without downloading actual files
    // In a production implementation, you'd download files from S3/R2 and include them
    for (const url of mediaUrls) {
      // Extract filename from URL and create placeholder entry
      const urlPath = new URL(url).pathname;
      manifest.media.push({
        path: `media${urlPath}`,
        sha256: crypto.createHash('sha256').update(url).digest('hex'), // placeholder hash
        bytes: 0, // placeholder size
      });
    }
  }

  // Add manifest to zip
  const manifestJson = JSON.stringify(manifest, null, 2);
  zip.file("manifest.json", manifestJson);

  // Generate zip file
  if (verbose) console.log("Generating zip file...");
  const zipBuffer = await zip.generateAsync({ type: "uint8array" });
  
  // Write to disk
  await fs.writeFile(outputPath, zipBuffer);
  
  if (verbose) {
    console.log(`Backup created: ${outputPath}`);
    console.log(`Total size: ${zipBuffer.length} bytes`);
    console.log("Counts:", manifest.counts);
  }

  return outputPath;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
  const skipMedia = process.argv.includes("--skip-media");
  const outputIndex = process.argv.findIndex(arg => arg === "--output" || arg === "-o");
  const outputPath = outputIndex !== -1 ? process.argv[outputIndex + 1] : undefined;

  createBackup({
    outputPath,
    includeMedia: !skipMedia,
    verbose,
  })
    .then(path => {
      console.log(`✅ Backup created successfully: ${path}`);
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Backup failed:", error);
      process.exit(1);
    });
}