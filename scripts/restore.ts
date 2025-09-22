// SPDX-License-Identifier: Apache-2.0
import JSZip from "jszip";
import { db } from "../lib/db";
import { posts, users, comments, commentAttachments, reactions, redirects, configuration } from "../drizzle/schema";
import fs from "node:fs/promises";
import { eq, and, sql, between } from "drizzle-orm";
import type { BackupManifest } from "./backup";

export interface RestoreOptions {
  backupPath: string;
  dryRun?: boolean;
  filterSlugs?: string[];
  startDate?: Date;
  endDate?: Date;
  verbose?: boolean;
  skipUsers?: boolean;
  skipConfiguration?: boolean;
}

export interface RestorePreview {
  tables: {
    [tableName: string]: {
      toInsert: number;
      toUpdate: number;
      toSkip: number;
    };
  };
  filteredRecords: {
    posts: number;
    comments: number;
  };
}

export async function restoreBackup(options: RestoreOptions): Promise<RestorePreview | void> {
  const {
    backupPath,
    dryRun = false,
    filterSlugs = [],
    startDate,
    endDate,
    verbose = false,
    skipUsers = false,
    skipConfiguration = false,
  } = options;

  if (verbose) {
    console.log(`${dryRun ? "Previewing" : "Starting"} restore from: ${backupPath}`);
  }

  // Read and parse zip file
  const zipBuffer = await fs.readFile(backupPath);
  const zip = await JSZip.loadAsync(new Uint8Array(zipBuffer));

  // Read manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid backup: manifest.json not found");
  }
  
  const manifestContent = await manifestFile.async("text");
  const manifest: BackupManifest = JSON.parse(manifestContent);

  if (verbose) {
    console.log(`Backup version: ${manifest.version}`);
    console.log(`Created: ${manifest.createdUtc}`);
    console.log("Original counts:", manifest.counts);
  }

  const preview: RestorePreview = {
    tables: {},
    filteredRecords: { posts: 0, comments: 0 },
  };

  // Helper function to filter posts by criteria
  const filterPosts = (postsData: any[]) => {
    let filtered = postsData;

    if (filterSlugs.length > 0) {
      filtered = filtered.filter(post => filterSlugs.includes(post.slug));
    }

    if (startDate || endDate) {
      filtered = filtered.filter(post => {
        if (!post.publishedAt) return false;
        const publishedAt = new Date(post.publishedAt);
        
        if (startDate && publishedAt < startDate) return false;
        if (endDate && publishedAt > endDate) return false;
        
        return true;
      });
    }

    return filtered;
  };

  // Restore posts
  const postsFile = zip.file("db/posts.json");
  if (postsFile) {
    const postsContent = await postsFile.async("text");
    const allPostsData = JSON.parse(postsContent);
    const filteredPostsData = filterPosts(allPostsData);
    
    preview.filteredRecords.posts = filteredPostsData.length;
    preview.tables.posts = { toInsert: 0, toUpdate: 0, toSkip: 0 };

    if (verbose && filteredPostsData.length !== allPostsData.length) {
      console.log(`Filtered posts: ${filteredPostsData.length} of ${allPostsData.length}`);
    }

    if (!dryRun) {
      for (const post of filteredPostsData) {
        try {
          // Check if post exists by GUID or slug
          const existing = await db
            .select()
            .from(posts)
            .where(
              post.guid 
                ? eq(posts.guid, post.guid)
                : eq(posts.slug, post.slug)
            )
            .limit(1);

          if (existing.length > 0) {
            // Update existing post
            const existingPost = existing[0];
            if (existingPost) {
              await db
                .update(posts)
                .set({
                  title: post.title,
                  html: post.html,
                  excerpt: post.excerpt,
                  publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
                  updatedAt: new Date(),
                })
                .where(eq(posts.id, existingPost.id));
              
              preview.tables.posts.toUpdate++;
              if (verbose) console.log(`Updated post: ${post.slug}`);
            }
          } else {
            // Insert new post
            await db.insert(posts).values({
              ...post,
              id: post.id, // Preserve original ID if possible
              publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
              createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
              updatedAt: post.updatedAt ? new Date(post.updatedAt) : new Date(),
            });
            
            preview.tables.posts.toInsert++;
            if (verbose) console.log(`Inserted post: ${post.slug}`);
          }
        } catch (error) {
          if (verbose) console.warn(`Failed to restore post ${post.slug}:`, error);
          preview.tables.posts.toSkip++;
        }
      }
    } else {
      // Dry run - just count what would be done
      for (const post of filteredPostsData) {
        const existing = await db
          .select()
          .from(posts)
          .where(
            post.guid 
              ? eq(posts.guid, post.guid)
              : eq(posts.slug, post.slug)
          )
          .limit(1);

        if (existing.length > 0) {
          preview.tables.posts.toUpdate++;
        } else {
          preview.tables.posts.toInsert++;
        }
      }
    }
  }

  // Restore users (unless skipped)
  if (!skipUsers) {
    const usersFile = zip.file("db/users.json");
    if (usersFile) {
      const usersContent = await usersFile.async("text");
      const usersData = JSON.parse(usersContent);
      
      preview.tables.users = { toInsert: 0, toUpdate: 0, toSkip: 0 };

      if (!dryRun) {
        for (const user of usersData) {
          try {
            const existing = await db
              .select()
              .from(users)
              .where(eq(users.email, user.email))
              .limit(1);

            if (existing.length > 0) {
              const existingUser = existing[0];
              if (existingUser) {
                await db
                  .update(users)
                  .set({
                    name: user.name,
                    image: user.image,
                  })
                  .where(eq(users.id, existingUser.id));
                
                preview.tables.users.toUpdate++;
                if (verbose) console.log(`Updated user: ${user.email}`);
              }
            } else {
              await db.insert(users).values(user);
              preview.tables.users.toInsert++;
              if (verbose) console.log(`Inserted user: ${user.email}`);
            }
          } catch (error) {
            if (verbose) console.warn(`Failed to restore user ${user.email}:`, error);
            preview.tables.users.toSkip++;
          }
        }
      } else {
        for (const user of usersData) {
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (existing.length > 0) {
            preview.tables.users.toUpdate++;
          } else {
            preview.tables.users.toInsert++;
          }
        }
      }
    }
  }

  // Restore configuration (unless skipped)
  if (!skipConfiguration) {
    const configFile = zip.file("db/configuration.json");
    if (configFile) {
      const configContent = await configFile.async("text");
      const configData = JSON.parse(configContent);
      
      preview.tables.configuration = { toInsert: 0, toUpdate: 0, toSkip: 0 };

      if (!dryRun) {
        for (const config of configData) {
          try {
            const existing = await db
              .select()
              .from(configuration)
              .where(
                and(
                  eq(configuration.key, config.key),
                  config.userId ? eq(configuration.userId, config.userId) : sql`user_id is null`
                )
              )
              .limit(1);

            if (existing.length > 0) {
              const existingConfig = existing[0];
              if (existingConfig) {
                await db
                  .update(configuration)
                  .set({
                    value: config.value,
                    type: config.type,
                    allowedValues: config.allowedValues,
                    required: config.required,
                    updatedAt: new Date(),
                  })
                  .where(eq(configuration.id, existingConfig.id));
                
                preview.tables.configuration.toUpdate++;
                if (verbose) console.log(`Updated config: ${config.key}`);
              }
            } else {
              await db.insert(configuration).values({
                ...config,
                createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
                updatedAt: config.updatedAt ? new Date(config.updatedAt) : new Date(),
              });
              
              preview.tables.configuration.toInsert++;
              if (verbose) console.log(`Inserted config: ${config.key}`);
            }
          } catch (error) {
            if (verbose) console.warn(`Failed to restore config ${config.key}:`, error);
            preview.tables.configuration.toSkip++;
          }
        }
      } else {
        for (const config of configData) {
          const existing = await db
            .select()
            .from(configuration)
            .where(
              and(
                eq(configuration.key, config.key),
                config.userId ? eq(configuration.userId, config.userId) : sql`user_id is null`
              )
            )
            .limit(1);

          if (existing.length > 0) {
            preview.tables.configuration.toUpdate++;
          } else {
            preview.tables.configuration.toInsert++;
          }
        }
      }
    }
  }

  // TODO: Restore other tables (comments, reactions, etc.) based on filtered posts
  // This would require filtering comments by post IDs and maintaining referential integrity

  if (dryRun) {
    if (verbose) {
      console.log("\n=== DRY RUN PREVIEW ===");
      console.log("Changes that would be made:");
      Object.entries(preview.tables).forEach(([table, counts]) => {
        console.log(`${table}: insert ${counts.toInsert}, update ${counts.toUpdate}, skip ${counts.toSkip}`);
      });
      
      if (preview.filteredRecords.posts > 0) {
        console.log(`\nFiltered to ${preview.filteredRecords.posts} posts`);
      }
    }
    return preview;
  } else {
    if (verbose) {
      console.log("\n=== RESTORE COMPLETE ===");
      Object.entries(preview.tables).forEach(([table, counts]) => {
        console.log(`${table}: inserted ${counts.toInsert}, updated ${counts.toUpdate}, skipped ${counts.toSkip}`);
      });
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const backupPath = args[0];
  
  if (!backupPath) {
    console.error("Usage: tsx scripts/restore.ts <backup.zip> [options]");
    console.error("Options:");
    console.error("  --dry-run          Preview changes without applying them");
    console.error("  --verbose, -v      Enable verbose output");
    console.error("  --slugs slug1,slug2  Restore only specific posts by slug");
    console.error("  --start-date YYYY-MM-DD  Restore posts from this date onwards");
    console.error("  --end-date YYYY-MM-DD    Restore posts up to this date");
    console.error("  --skip-users       Skip restoring users");
    console.error("  --skip-config      Skip restoring configuration");
    process.exit(1);
  }

  const options: RestoreOptions = {
    backupPath,
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    skipUsers: args.includes("--skip-users"),
    skipConfiguration: args.includes("--skip-config"),
  };

  // Parse slugs filter
  const slugsIndex = args.findIndex(arg => arg === "--slugs");
  if (slugsIndex !== -1) {
    const slugsArg = args[slugsIndex + 1];
    if (slugsArg) {
      options.filterSlugs = slugsArg.split(",");
    }
  }

  // Parse date filters
  const startDateIndex = args.findIndex(arg => arg === "--start-date");
  if (startDateIndex !== -1) {
    const startDateArg = args[startDateIndex + 1];
    if (startDateArg) {
      options.startDate = new Date(startDateArg);
    }
  }

  const endDateIndex = args.findIndex(arg => arg === "--end-date");
  if (endDateIndex !== -1) {
    const endDateArg = args[endDateIndex + 1];
    if (endDateArg) {
      options.endDate = new Date(endDateArg);
    }
  }

  restoreBackup(options)
    .then(() => {
      console.log("✅ Restore completed successfully");
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Restore failed:", error);
      process.exit(1);
    });
}