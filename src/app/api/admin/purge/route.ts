// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import logger from '@/lib/logger';
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataOperationLogs, posts, comments, commentAttachments } from "@/drizzle/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { getS3Config, S3Service } from "@/lib/s3";
import { localStorageService } from "@/lib/local-storage";
import { nanoid } from "nanoid";
import { z } from "zod";
import { safeApiError } from "@/lib/api-error";

const purgeRequestSchema = z.object({
  type: z.enum(["post", "comment"]),
  mode: z.enum(["soft", "hard"]),
  dryRun: z.boolean().default(true),
  
  // Identifiers
  id: z.string().trim().uuid().optional(),
  slug: z.string().trim().min(1).optional(),
  ids: z.array(z.string().uuid()).min(1).optional(),
  
  allPosts: z.literal(true).optional(),

  // Filters for bulk operations
  filter: z.object({
    createdBefore: z.string().refine(value => Number.isFinite(Date.parse(value)), "Invalid date").optional(),
    status: z.string().optional(),
    userId: z.string().uuid().optional(),
  }).strict().optional(),
  
  // Confirmation for hard delete
  confirmationPhrase: z.string().optional(),
}).strict().refine(({ type, mode, id, ids, slug, filter, allPosts }) => {
  const supplied = [id, ids, slug, filter, allPosts].filter(Boolean).length;
  if (supplied !== 1) return false;
  if (allPosts) return type === "post" && mode === "hard";
  if (slug) return type === "post";
  if (filter) return Object.keys(filter).length > 0 && (type === "comment" || (!filter.userId && !filter.status));
  return true;
}, "Select one valid target");

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    // Derive a safe user id for audit/deletedBy, even if tests mock requireAdmin2FA() as boolean
    const currentUserId = (session && typeof session === "object" && (session as any).user && (session as any).user.id) ? (session as any).user.id : null;

    const body = await req.json();
    const parsed = purgeRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: { 
          message: "Invalid request",
          details: parsed.error.issues 
        }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { type, mode, dryRun, id, slug, ids, filter, allPosts, confirmationPhrase } = parsed.data;

    // Validate hard delete confirmation — compute effective target the same way UI should
    if (mode === "hard" && !dryRun) {
      const effectiveTarget = id || slug || "BULK";
      const expectedPhrase = `DELETE ${type} ${effectiveTarget}`;
      if (confirmationPhrase !== expectedPhrase) {
        return new Response(JSON.stringify({
          ok: false,
          error: { 
            message: `Hard delete requires confirmation phrase: "${expectedPhrase}"` 
          }
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Create audit log entry
    const operationId = nanoid();
    const operationType = mode === "soft" ? "purge_soft" : "purge_hard";
    const logEntry = await db.insert(dataOperationLogs).values({
      operationType,
      userId: currentUserId,
      details: {
        type,
        mode,
        dryRun,
        id,
        slug,
        ids,
        filter,
        operationId,
        allPosts,
      },
      status: "started",
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    }).returning();

    try {
      let recordsAffected = 0;
      const preview: any = {
        type,
        mode,
        records: [],
        cascadeEffects: {},
      };

      if (type === "post") {
        // Build query conditions
        const whereConditions: any[] = [];

        if (id) {
          whereConditions.push(eq(posts.id, id));
        } else if (slug) {
          whereConditions.push(eq(posts.slug, slug));
        } else if (ids?.length) {
          whereConditions.push(inArray(posts.id, ids));
        } else if (filter) {
          if (filter.createdBefore) {
            whereConditions.push(sql`${posts.createdAt} < ${filter.createdBefore}`);
          }
          // Add other filter conditions as needed
        }

        // Only show non-deleted posts for soft delete
        if (mode === "soft") {
          whereConditions.push(isNull(posts.deletedAt));
        }

        const whereClause = allPosts ? sql`true` : and(...whereConditions);

        // Get posts that would be affected
        const postsToDelete = await db
          .select({
            id: posts.id,
            slug: posts.slug,
            title: posts.title,
            createdAt: posts.createdAt,
            featuredImageUrl: posts.featuredImageUrl,
            bodyHtml: posts.bodyHtml,
            html: posts.html,
          })
          .from(posts)
          .where(whereClause);

        recordsAffected = postsToDelete.length;
        preview.records = postsToDelete;

        if (postsToDelete.length > 0) {
          const postIds = postsToDelete.map((p: any) => p.id);
          
          // Check cascade effects (comments that would be affected)
          const commentsCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(comments)
            .where(
              and(
                inArray(comments.postId, postIds),
                isNull(comments.deletedAt)
              )
            );
          
          preview.cascadeEffects.comments = commentsCount[0]?.count || 0;

          if (!dryRun) {
            if (mode === "soft") {
              // Soft delete posts
              await db
                .update(posts)
                .set({
                  deletedAt: new Date(),
                  deletedBy: currentUserId,
                })
                .where(whereClause);
            } else {
              // Hard delete posts (comments cascade via foreign key)
              // Snapshot media references before cascade deletion.
              // - post featuredImageUrl
              // - post HTML/bodyHtml fields
              // - comment attachments (url/posterUrl) under these posts
              const keys = new Set<string>();
              try {

                const extractImportedKeys = (text?: string | null) => {
                  if (!text) return;
                  const regex = /imported-media\/[A-Za-z0-9._\/-]+/g;
                  const matches = text.match(regex);
                  if (matches) matches.filter(k => /^imported-media\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(k)).forEach(k => keys.add(k));
                };

                // Collect from post records
                for (const p of postsToDelete as Array<any>) {
                  extractImportedKeys(p.featuredImageUrl);
                  extractImportedKeys(p.bodyHtml);
                  extractImportedKeys(p.html);
                }

                // Collect from comment attachments for these posts
                if (postIds.length > 0) {
                  const base: any = db
                    .select({ url: commentAttachments.url, posterUrl: commentAttachments.posterUrl })
                    .from(commentAttachments);
                  if (typeof base.leftJoin === "function") {
                    const attachments = await base
                      .leftJoin(comments, eq(comments.id, commentAttachments.commentId))
                      .where(inArray(comments.postId, postIds));
                    for (const a of (attachments as Array<any>) ?? []) {
                      extractImportedKeys(a.url);
                      extractImportedKeys(a.posterUrl);
                    }
                  }
                }

              } catch (error) {
                keys.clear();
                logger.warn("Could not collect media for cleanup", error);
              }

              // A concurrent insert matching a bulk filter was not part of this snapshot.
              await db.delete(posts).where(inArray(posts.id, postIds));
              if (keys.size) {
                try {
                  const candidates = sql.join([...keys].map(key => sql`${key}::text`), sql`, `);
                  const unused = await db.execute(sql`
                    SELECT key FROM unnest(ARRAY[${candidates}]) AS media(key)
                    WHERE NOT EXISTS (SELECT 1 FROM posts WHERE strpos(concat_ws(' ', html, body_html, body_md, excerpt, featured_image_url), media.key) > 0)
                      AND NOT EXISTS (SELECT 1 FROM comments WHERE strpos(concat_ws(' ', body_html, body_md), media.key) > 0)
                      AND NOT EXISTS (SELECT 1 FROM comment_attachments WHERE strpos(concat_ws(' ', url, poster_url), media.key) > 0)
                      AND NOT EXISTS (SELECT 1 FROM configuration WHERE strpos(value::text, media.key) > 0)
                      AND NOT EXISTS (SELECT 1 FROM users WHERE strpos(image, media.key) > 0)
                      AND NOT EXISTS (SELECT 1 FROM uploads WHERE uploads.key = media.key OR strpos(url, media.key) > 0)
                  `);
                  const cfg = getS3Config();
                  const storage = cfg ? new S3Service(cfg) : localStorageService;
                  for (const row of unused.rows) await storage.deleteObject(String(row.key));
                } catch (error) {
                  logger.warn("Imported media cleanup could not finish", error);
                }
              }
            }
          }
        }

      } else if (type === "comment") {
        // Similar logic for comments
        const whereConditions: any[] = [];

        if (id) {
          whereConditions.push(eq(comments.id, id));
        } else if (ids?.length) {
          whereConditions.push(inArray(comments.id, ids));
        } else if (filter) {
          if (filter.createdBefore) {
            whereConditions.push(sql`${comments.createdAt} < ${filter.createdBefore}`);
          }
          if (filter.status) {
            whereConditions.push(eq(comments.status, filter.status));
          }
          if (filter.userId) {
            whereConditions.push(eq(comments.userId, filter.userId));
          }
        }

        if (mode === "soft") {
          whereConditions.push(isNull(comments.deletedAt));
        }

        if (whereConditions.length === 0) {
          throw new Error("No valid identifiers or filters provided");
        }

        const whereClause = whereConditions.length === 1 
          ? whereConditions[0] 
          : and(...whereConditions);

        const commentsToDelete = await db
          .select({
            id: comments.id,
            postId: comments.postId,
            bodyHtml: comments.bodyHtml,
            createdAt: comments.createdAt,
          })
          .from(comments)
          .where(whereClause);

        recordsAffected = commentsToDelete.length;
  preview.records = commentsToDelete.map((c: any) => ({
          id: c.id,
          postId: c.postId,
          excerpt: c.bodyHtml.substring(0, 100) + "...",
          createdAt: c.createdAt,
        }));

        if (commentsToDelete.length > 0 && !dryRun) {
          if (mode === "soft") {
            await db
              .update(comments)
              .set({
                deletedAt: new Date(),
                deletedBy: currentUserId,
              })
              .where(whereClause);
          } else {
            await db.delete(comments).where(whereClause);
          }
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
        dryRun,
        recordsAffected,
        preview,
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
    const publicError = safeApiError(err, "Purge failed");
    
    return new Response(JSON.stringify({
      ok: false,
      error: { message: publicError.message }
    }), {
      status: publicError.status,
      headers: { "Content-Type": "application/json" }
    });
  }
}
